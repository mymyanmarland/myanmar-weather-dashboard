// API routes: JSON endpoints + form-post mutations (302 redirects).
"use strict";

const express = require("express");

const auth = require("../auth");
const service = require("../weather/service");
const validate = require("../lib/validate");
const { rateLimit } = require("../ratelimit");
const { savePrefs } = require("../lib/prefs");
const { searchLocalLocations, locationHierarchy } = require("../lib/locations");
const { MYANMAR_LOCATIONS } = require("../lib/locations");

const router = express.Router();

const geocodeLimiter = rateLimit({ limit: 30, windowMs: 60 * 1000, keyPrefix: "geocode" });

function dbOf(req) {
  return req.app.locals.db;
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "unauthorized" });
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}

function safeRedirect(v, fallback = "/") {
  const s = String(v || fallback);
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

// --- Geocoding (Myanmar-biased: local 12-city search first, then Open-Meteo) --
router.get("/api/geocode", geocodeLimiter, async (req, res) => {
  const lang = (req.cookies && req.cookies.mw_lang) === "en" ? "en" : "my";
  const v = validate.query(req.query.q);
  if (!v.ok) return res.json({ results: [] });
  const local = searchLocalLocations(v.value, 6).map((l) => ({
    name: lang === "my" ? l.nameMy : l.nameEn,
    nameEn: l.nameEn,
    latitude: l.lat,
    longitude: l.lon,
    countryCode: "MM",
    admin1: lang === "my" ? l.stateMy : l.stateEn,
    admin2: null,
    admin3: null,
    hier: locationHierarchy(l, lang),
    local: true,
  }));
  let remote = [];
  try {
    remote = (await service.geocodeSearch(v.value, 8)).map((r) => ({
      ...r,
      nameEn: r.name,
      hier: [r.admin3, r.admin2, r.admin1].filter(Boolean).join(" › "),
      local: false,
    }));
  } catch {
    remote = [];
  }
  // De-dupe remote results that match a local city.
  const seen = new Set(local.map((l) => `${l.latitude.toFixed(2)},${l.longitude.toFixed(2)}`));
  const merged = local.concat(
    remote.filter((r) => !seen.has(`${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`)),
  ).slice(0, 10);
  res.json({ results: merged });
});

// --- Overview JSON (map page + compare widgets) ------------------------------
router.get("/api/overview", async (req, res) => {
  try {
    const overview = await service.getOverview(MYANMAR_LOCATIONS);
    const lang = (req.cookies && req.cookies.mw_lang) === "en" ? "en" : "my";
    const settled = await Promise.allSettled(
      overview.map(async (o) => {
        if (!o.current) return { count: 0 };
        const areaName = lang === "my" ? o.city.nameMy : o.city.nameEn;
        const r = await service.getWeatherAlerts({ lat: o.city.lat, lon: o.city.lon }, areaName);
        return { count: (r.data || []).length };
      }),
    );
    res.json({
      cities: overview.map((o, i) => ({
        id: o.city.id,
        nameEn: o.city.nameEn,
        nameMy: o.city.nameMy,
        lat: o.city.lat,
        lon: o.city.lon,
        current: o.current,
        stale: o.stale,
        alertCount: settled[i] && settled[i].status === "fulfilled" ? settled[i].value.count : 0,
      })),
    });
  } catch {
    res.status(502).json({ error: "providerUnavailable" });
  }
});

// --- Preferences -------------------------------------------------------------
router.post("/api/prefs", (req, res) => {
  const db = dbOf(req);
  const body = {
    language: req.body.language,
    tempUnit: req.body.tempUnit,
    windUnit: req.body.windUnit,
    timeFormat: req.body.timeFormat,
    theme: req.body.theme,
  };
  const v = validate.prefsBody(body);
  if (!v.ok) return res.redirect(safeRedirect(req.body.redirect, "/settings"));
  savePrefs(req, res, db, v.value);
  res.redirect(safeRedirect(req.body.redirect, "/settings"));
});

// --- Favorites (registered users only) ---------------------------------------
router.post("/api/favorites", requireAuth, (req, res) => {
  const db = dbOf(req);
  const v = validate.favoriteBody(req.body);
  if (!v.ok) return res.redirect("/favorites?err=common.error");
  const f = v.value;
  const dup = db.prepare(
    "SELECT id FROM favorite_locations WHERE user_id = ? AND ABS(lat - ?) < 0.01 AND ABS(lon - ?) < 0.01 LIMIT 1",
  ).get(req.user.id, f.lat, f.lon);
  if (dup) return res.redirect(safeRedirect(req.body.redirect, "/favorites") + "?ok=favorites.alreadySaved");
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM favorite_locations WHERE user_id = ?").get(req.user.id);
  const count = db.prepare("SELECT COUNT(*) AS c FROM favorite_locations WHERE user_id = ?").get(req.user.id);
  db.prepare(
    `INSERT INTO favorite_locations (user_id, location_id, name_en, name_my, state_en, state_my, lat, lon, is_default, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    req.user.id, f.locationId, f.nameEn, f.nameMy, f.stateEn, f.stateMy,
    f.lat, f.lon, count.c === 0 ? 1 : 0, maxOrder.m + 1, new Date().toISOString(),
  );
  res.redirect(safeRedirect(req.body.redirect, "/favorites") + "?ok=favorites.addedOk");
});

router.post("/api/favorites/:id/default", requireAuth, (req, res) => {
  const db = dbOf(req);
  const id = Number(req.params.id);
  const row = db.prepare("SELECT id FROM favorite_locations WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!row) return res.redirect("/favorites?err=common.notFound");
  db.prepare("UPDATE favorite_locations SET is_default = 0 WHERE user_id = ?").run(req.user.id);
  db.prepare("UPDATE favorite_locations SET is_default = 1 WHERE id = ?").run(id);
  res.redirect("/favorites?ok=favorites.defaultOk");
});

router.post("/api/favorites/:id/move", requireAuth, (req, res) => {
  const db = dbOf(req);
  const id = Number(req.params.id);
  const dir = req.body.dir === "down" ? 1 : -1;
  const favs = db.prepare("SELECT id, sort_order FROM favorite_locations WHERE user_id = ? ORDER BY sort_order, id").all(req.user.id);
  const idx = favs.findIndex((f) => f.id === id);
  if (idx < 0) return res.redirect("/favorites?err=common.notFound");
  const j = idx + dir;
  if (j < 0 || j >= favs.length) return res.redirect("/favorites");
  const a = favs[idx], b = favs[j];
  db.prepare("UPDATE favorite_locations SET sort_order = ? WHERE id = ?").run(b.sort_order, a.id);
  db.prepare("UPDATE favorite_locations SET sort_order = ? WHERE id = ?").run(a.sort_order, b.id);
  res.redirect("/favorites");
});

router.post("/api/favorites/:id/delete", requireAuth, (req, res) => {
  const db = dbOf(req);
  const id = Number(req.params.id);
  const row = db.prepare("SELECT is_default FROM favorite_locations WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!row) return res.redirect("/favorites?err=common.notFound");
  db.prepare("DELETE FROM favorite_locations WHERE id = ?").run(id);
  if (row.is_default) {
    const next = db.prepare("SELECT id FROM favorite_locations WHERE user_id = ? ORDER BY sort_order, id LIMIT 1").get(req.user.id);
    if (next) db.prepare("UPDATE favorite_locations SET is_default = 1 WHERE id = ?").run(next.id);
  }
  res.redirect("/favorites?ok=favorites.removedOk");
});

// --- Alert subscriptions ------------------------------------------------------
router.post("/api/alert-subscriptions", requireAuth, (req, res) => {
  const db = dbOf(req);
  const v = validate.subscriptionBody(req.body);
  if (!v.ok) return res.redirect("/alerts?err=common.error");
  const s = v.value;
  db.prepare(
    "INSERT INTO alert_subscriptions (user_id, name_en, lat, lon, severity_threshold, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(req.user.id, s.nameEn, s.lat, s.lon, s.severityThreshold, new Date().toISOString());
  res.redirect("/alerts");
});

router.post("/api/alert-subscriptions/:id/delete", requireAuth, (req, res) => {
  const db = dbOf(req);
  db.prepare("DELETE FROM alert_subscriptions WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user.id);
  res.redirect("/alerts");
});

// --- Admin: announcements (placeholder) ----------------------------------------
router.post("/api/admin/announcements", requireAuth, requireAdmin, (req, res) => {
  const db = dbOf(req);
  const v = validate.announcementBody(req.body);
  if (!v.ok) return res.redirect("/admin?err=common.error");
  const a = v.value;
  db.prepare(
    `INSERT INTO manual_announcements (title_my, title_en, body_my, body_en, severity, is_published, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(a.titleMy, a.titleEn, a.bodyMy, a.bodyEn, a.severity, a.isPublished ? 1 : 0, req.user.id, new Date().toISOString());
  res.redirect("/admin");
});

// --- Account deletion ------------------------------------------------------------
router.post("/api/account/delete", requireAuth, (req, res) => {
  const db = dbOf(req);
  auth.destroySession(db, req.cookies ? req.cookies[auth.SESSION_COOKIE] : null);
  db.prepare("DELETE FROM users WHERE id = ?").run(req.user.id);
  auth.clearSessionCookie(res);
  res.redirect("/?ok=auth.accountDeleted");
});

module.exports = router;

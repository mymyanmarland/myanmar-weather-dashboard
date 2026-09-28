// GET page routes. All pages render server-side; client JS only enhances.
"use strict";

const express = require("express");

const service = require("../weather/service");
const { esc } = require("../lib/format");
const { layout, pageCtx } = require("../views/layout");
const { homePage } = require("../views/pages/home");
const { searchPage } = require("../views/pages/search");
const { alertsPage } = require("../views/pages/alerts");
const { mapPage } = require("../views/pages/map");
const { favoritesPage } = require("../views/pages/favorites");
const { settingsPage } = require("../views/pages/settings");
const { loginPage, signupPage } = require("../views/pages/auth");
const { adminPage } = require("../views/pages/admin");
const {
  DEFAULT_LOCATION,
  MYANMAR_LOCATIONS,
  getLocationById,
  searchLocalLocations,
  locationDisplayName,
  locationHierarchy,
} = require("../lib/locations");
const validate = require("../lib/validate");

const router = express.Router();

function dbOf(req) {
  return req.app.locals.db;
}

function safeNext(v) {
  const s = String(v || "/");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

/** Resolve which location the dashboard should show. */
function resolveLocation(req) {
  const q = req.query || {};
  if (q.id) {
    const l = getLocationById(String(q.id));
    if (l) return { ...l, isDefaultLoc: false };
  }
  const c = validate.coords(q.lat, q.lon);
  if (c.ok) {
    const name = String(q.name || "").slice(0, 120);
    return {
      lat: c.value.lat,
      lon: c.value.lon,
      nameEn: name || `${c.value.lat.toFixed(2)}, ${c.value.lon.toFixed(2)}`,
      nameMy: "",
      stateEn: "",
      stateMy: "",
      custom: true,
      isDefaultLoc: false,
    };
  }
  const db = dbOf(req);
  if (req.user && db) {
    try {
      const f = db
        .prepare("SELECT name_en, name_my, state_en, state_my, lat, lon FROM favorite_locations WHERE user_id = ? AND is_default = 1 ORDER BY sort_order LIMIT 1")
        .get(req.user.id);
      if (f) {
        return {
          lat: f.lat, lon: f.lon, nameEn: f.name_en, nameMy: f.name_my,
          stateEn: f.state_en, stateMy: f.state_my, isDefaultLoc: false,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { ...DEFAULT_LOCATION, isDefaultLoc: true };
}

function publishedAnnouncements(db) {
  try {
    return db
      .prepare("SELECT * FROM manual_announcements WHERE is_published = 1 ORDER BY created_at DESC LIMIT 5")
      .all();
  } catch {
    return [];
  }
}

// --- Home ---------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const db = dbOf(req);
    const ctx = pageCtx(req, db, { title: "", active: "home" });
    const loc = resolveLocation(req);
    ctx.title = locationDisplayName(loc, ctx.lang);
    const areaName = locationDisplayName(loc, ctx.lang);
    const ll = { lat: loc.lat, lon: loc.lon };

    const [cur, hr, dy, al, ov] = await Promise.allSettled([
      service.getCurrentWeather(ll),
      service.getHourlyForecast(ll),
      service.getDailyForecast(ll),
      service.getWeatherAlerts(ll, areaName),
      service.getOverview(MYANMAR_LOCATIONS),
    ]);

    let isFavorite = false;
    if (req.user && db) {
      try {
        const row = db.prepare(
          "SELECT id FROM favorite_locations WHERE user_id = ? AND ABS(lat - ?) < 0.01 AND ABS(lon - ?) < 0.01 LIMIT 1",
        ).get(req.user.id, ll.lat, ll.lon);
        isFavorite = !!row;
      } catch {
        /* ignore */
      }
    }

    const data = {
      loc,
      current: cur.status === "fulfilled" ? cur.value : null,
      hourly: hr.status === "fulfilled" ? hr.value : null,
      daily: dy.status === "fulfilled" ? dy.value : null,
      alerts: al.status === "fulfilled" ? al.value : null,
      overview: ov.status === "fulfilled" ? ov.value : null,
      announcements: publishedAnnouncements(db),
      isFavorite,
      isDefaultLoc: !!loc.isDefaultLoc,
    };
    res.send(layout(ctx, homePage(ctx, data)));
  } catch (err) {
    next(err);
  }
});

// --- Search -------------------------------------------------------------
router.get("/search", async (req, res, next) => {
  try {
    const db = dbOf(req);
    const rawQ = (req.query.q || "").toString();
    const ctx = pageCtx(req, db, { title: "", active: "search", scripts: ["/js/search.js", "/js/recent.js", "/js/geo.js"] });
    ctx.title = ctx.t("search.title");
    const data = { q: rawQ, searched: false, localResults: [], geoResults: [] };
    if (rawQ.trim()) {
      const v = validate.query(rawQ);
      if (v.ok) {
        data.searched = true;
        data.q = v.value;
        data.localResults = searchLocalLocations(v.value).map((l) => ({
          lat: l.lat, lon: l.lon, nameEn: l.nameEn, nameMy: l.nameMy,
          hier: locationHierarchy(l, ctx.lang),
        }));
        try {
          const geo = await service.geocodeSearch(v.value, 8);
          data.geoResults = geo.map((r) => ({
            lat: r.latitude, lon: r.longitude, nameEn: r.name, nameMy: "",
            hier: [r.admin3, r.admin2, r.admin1].filter(Boolean).join(" › "),
          }));
        } catch {
          data.geoResults = [];
        }
      }
    }
    res.send(layout(ctx, searchPage(ctx, data)));
  } catch (err) {
    next(err);
  }
});

// --- Alerts -------------------------------------------------------------
router.get("/alerts", async (req, res, next) => {
  try {
    const db = dbOf(req);
    const ctx = pageCtx(req, db, { title: "", active: "alerts" });
    ctx.title = ctx.t("alertsPage.title");
    const settled = await Promise.allSettled(
      MYANMAR_LOCATIONS.map(async (city) => {
        const areaName = locationDisplayName(city, ctx.lang);
        const r = await service.getWeatherAlerts({ lat: city.lat, lon: city.lon }, areaName);
        return { city, cityName: areaName, alerts: r.data, stale: r.stale };
      }),
    );
    const groups = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => s.value);
    let subscriptions = [];
    if (req.user && db) {
      try {
        subscriptions = db.prepare("SELECT * FROM alert_subscriptions WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
      } catch {
        /* ignore */
      }
    }
    res.send(layout(ctx, alertsPage(ctx, {
      groups,
      subscriptions,
      announcements: publishedAnnouncements(db),
    })));
  } catch (err) {
    next(err);
  }
});

// --- Map ----------------------------------------------------------------
router.get("/map", (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "", active: "map", scripts: ["/js/map.js"] });
  ctx.title = ctx.t("mapPage.title");
  res.send(layout(ctx, mapPage(ctx)));
});

// --- Favorites ----------------------------------------------------------
router.get("/favorites", async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/login?next=/favorites");
    const db = dbOf(req);
    const ctx = pageCtx(req, db, { title: "", active: "favorites" });
    ctx.title = ctx.t("favorites.title");
    const favs = db.prepare("SELECT * FROM favorite_locations WHERE user_id = ? ORDER BY sort_order, id").all(req.user.id);
    const settled = await Promise.allSettled(
      favs.map(async (f) => {
        try {
          const r = await service.getCurrentWeather({ lat: f.lat, lon: f.lon });
          return { ...f, current: r.data };
        } catch {
          return { ...f, current: null };
        }
      }),
    );
    res.send(layout(ctx, favoritesPage(ctx, { favorites: settled.map((s) => (s.status === "fulfilled" ? s.value : { ...s.reason })) })));
  } catch (err) {
    next(err);
  }
});

// --- Settings -----------------------------------------------------------
router.get("/settings", (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "", active: "settings" });
  ctx.title = ctx.t("settings.title");
  res.send(layout(ctx, settingsPage(ctx)));
});

// --- Login / signup -----------------------------------------------------
router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "" });
  ctx.title = ctx.t("auth.loginTitle");
  res.send(layout(ctx, loginPage(ctx, { next: safeNext(req.query.next) })));
});

router.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/");
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "" });
  ctx.title = ctx.t("auth.signupTitle");
  res.send(layout(ctx, signupPage(ctx, { next: safeNext(req.query.next) })));
});

// --- Admin (placeholder, role-gated) ------------------------------------
router.get("/admin", (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/login?next=/admin");
    if (req.user.role !== "admin") {
      const db = dbOf(req);
      const ctx = pageCtx(req, db, { title: "", active: "admin" });
      ctx.title = ctx.t("common.forbidden");
      return res
        .status(403)
        .send(layout(ctx, `<section class="card center"><h1>${esc(ctx.t("common.forbidden"))}</h1><p><a class="btn btn-primary" href="/">${esc(ctx.t("nav.home"))}</a></p></section>`));
    }
    const db = dbOf(req);
    const ctx = pageCtx(req, db, { title: "", active: "admin" });
    ctx.title = ctx.t("admin.title");
    let locations = [], users = [], announcements = [], recentFetches = [];
    try {
      locations = db.prepare("SELECT * FROM locations ORDER BY name_en").all();
      users = db.prepare("SELECT email, role, created_at FROM users ORDER BY created_at").all();
      announcements = db.prepare("SELECT * FROM manual_announcements ORDER BY created_at DESC LIMIT 20").all();
      recentFetches = service.recentFetches(20);
    } catch {
      /* ignore */
    }
    res.send(layout(ctx, adminPage(ctx, { locations, users, announcements, recentFetches })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

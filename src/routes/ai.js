// AI routes: hub/setup/reports pages + server-side AI API.
//
// SECURITY: all AI provider calls happen here, server-side. The browser
// never sees the API key and never calls the gateway directly.
"use strict";

const express = require("express");

const service = require("../weather/service");
const { esc } = require("../lib/format");
const { layout, pageCtx } = require("../views/layout");
const { aiHubPage, aiSetupPage, aiReportsPage, aiReportPage, aiPrintPage } = require("../views/pages/ai");
const { MODELS, getModel, apiBase, DEFAULT_API_BASE } = require("../ai/models");
const { encrypt, decrypt, isEphemeral } = require("../ai/crypto");
const { chat, probe, ProviderError } = require("../ai/providers");
const { buildPrompt, TYPES } = require("../ai/prompts");
const { rateLimit } = require("../ratelimit");
const { DEFAULT_LOCATION, MYANMAR_LOCATIONS, getLocationById, locationDisplayName } = require("../lib/locations");

const router = express.Router();

function dbOf(req) {
  return req.app.locals.db;
}

function requireLogin(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false, error: "unauthorized" });
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  next();
}

function dailyLimit() {
  const v = parseInt(process.env.AI_DAILY_LIMIT || "10", 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

function getConfig(db, userId) {
  try {
    return db.prepare("SELECT * FROM ai_configs WHERE user_id = ?").get(userId) || null;
  } catch {
    return null;
  }
}

function saveConfig(db, userId, { apiBase: base, keyEnc, keyLast4, defaultModel }) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO ai_configs (user_id, api_base, api_key_enc, key_last4, default_model, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET api_base=excluded.api_base, api_key_enc=excluded.api_key_enc,
       key_last4=excluded.key_last4, default_model=excluded.default_model, updated_at=excluded.updated_at`,
  ).run(userId, base, keyEnc, keyLast4, defaultModel, now);
}

function usageToday(db, userId) {
  const day = new Date().toISOString().slice(0, 10);
  let count = 0;
  try {
    const row = db.prepare("SELECT count FROM ai_usage WHERE user_id = ? AND day = ?").get(userId, day);
    count = row ? row.count : 0;
  } catch { /* ignore */ }
  return { day, count };
}

function bumpUsage(db, userId, day) {
  try {
    db.prepare(
      `INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`,
    ).run(userId, day);
  } catch { /* ignore */ }
}

/** Resolve the user's default location (default favorite, else Yangon). */
function defaultLocation(req, db) {
  if (req.user && db) {
    try {
      const f = db.prepare(
        "SELECT name_en, name_my, state_en, state_my, lat, lon FROM favorite_locations WHERE user_id = ? AND is_default = 1 ORDER BY sort_order LIMIT 1",
      ).get(req.user.id);
      if (f) return { lat: f.lat, lon: f.lon, nameEn: f.name_en, nameMy: f.name_my };
    } catch { /* fall through */ }
  }
  return { ...DEFAULT_LOCATION };
}

function resolveAiLocation(req, db) {
  const id = String(req.body.locationId || req.query.locationId || "default");
  if (id !== "default") {
    const l = getLocationById(id);
    if (l) return { lat: l.lat, lon: l.lon, nameEn: l.nameEn, nameMy: l.nameMy };
  }
  return defaultLocation(req, db);
}

function validBase(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+(?::\d+)?(\/[^\s]*)?$/.test(s) ? s : null;
}

// --- Hub -----------------------------------------------------------------
router.get("/ai", (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "", active: "ai" });
  ctx.title = ctx.t("ai.title");
  const config = req.user ? getConfig(db, req.user.id) : null;
  let reports = [];
  if (req.user) {
    try {
      reports = db.prepare("SELECT id, type, location_name, model, created_at FROM ai_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").all(req.user.id);
    } catch { /* ignore */ }
  }
  res.send(layout(ctx, aiHubPage(ctx, {
    configured: !!(config && config.api_key_enc),
    defaultModel: (config && config.default_model) || "claude-sonnet-5",
    locations: MYANMAR_LOCATIONS,
    defaultLoc: defaultLocation(req, db),
    reports,
  })));
});

// --- Setup ---------------------------------------------------------------
router.get("/ai/setup", requireLogin, (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "", active: "ai" });
  ctx.title = ctx.t("ai.setupTitle");
  res.send(layout(ctx, aiSetupPage(ctx, { config: getConfig(db, req.user.id), ephemeral: isEphemeral() })));
});

router.post("/ai/setup", requireLogin, (req, res) => {
  const db = dbOf(req);
  const base = validBase(req.body.api_base);
  if (!base) return res.redirect("/ai/setup?err=ai.analyzeError");
  const model = getModel(req.body.default_model) ? req.body.default_model : "claude-sonnet-5";
  const existing = getConfig(db, req.user.id);
  const rawKey = String(req.body.api_key || "");
  let keyEnc = existing ? existing.api_key_enc : "";
  let keyLast4 = existing ? existing.key_last4 : "";
  if (rawKey) {
    if (rawKey.length < 8 || rawKey.length > 500) return res.redirect("/ai/setup?err=ai.analyzeError");
    keyEnc = encrypt(rawKey);
    keyLast4 = rawKey.slice(-4);
  }
  if (!keyEnc) return res.redirect("/ai/setup?err=ai.noKeyError");
  saveConfig(db, req.user.id, { apiBase: base, keyEnc, keyLast4, defaultModel: model });
  res.redirect("/ai/setup?ok=ai.saved");
});

// --- Test connection (uses supplied values; never saves) ------------------
const testLimiter = rateLimit({ limit: 10, windowMs: 10 * 60 * 1000, keyPrefix: "aitest" });

router.post("/api/ai/test", requireLogin, testLimiter, async (req, res) => {
  try {
    const base = validBase(req.body.api_base) || apiBase();
    const key = String(req.body.api_key || "");
    const m = getModel(req.body.model);
    if (!m || key.length < 8) return res.json({ ok: false, kind: "badRequest", error: "Bad request." });
    const r = await probe({ provider: m.provider, model: m.model, apiBase: base, apiKey: key });
    res.json(r);
  } catch (err) {
    res.json({ ok: false, kind: "error", error: "Test failed." });
  }
});

// --- Analyze (form POST → long server-side call → 302 to the report) -------
const analyzeLimiter = rateLimit({ limit: 5, windowMs: 10 * 60 * 1000, keyPrefix: "aianalyze" });

router.post("/api/ai/analyze", requireLogin, analyzeLimiter, async (req, res) => {
  const db = dbOf(req);
  const fail = (msg) => res.redirect("/ai?err=" + encodeURIComponent(msg));
  try {
    const type = String(req.body.type || "");
    if (!TYPES.includes(type)) return fail("ai.unknownModel");
    const m = getModel(req.body.model);
    if (!m) return fail("ai.unknownModel");

    const config = getConfig(db, req.user.id);
    if (!config || !config.api_key_enc) return fail("ai.noKeyError");
    let apiKey;
    try {
      apiKey = decrypt(config.api_key_enc);
    } catch {
      return fail("ai.noKeyError");
    }

    const { day, count } = usageToday(db, req.user.id);
    if (count >= dailyLimit()) return fail("ai.dailyLimit");

    const loc = resolveAiLocation(req, db);
    const ll = { lat: loc.lat, lon: loc.lon };
    const areaName = locationDisplayName(loc, "en");
    const [cur, hr, dy, al] = await Promise.allSettled([
      service.getCurrentWeather(ll),
      service.getHourlyForecast(ll),
      service.getDailyForecast(ll),
      service.getWeatherAlerts(ll, areaName),
    ]);
    const data = {
      loc,
      current: cur.status === "fulfilled" ? cur.value.data : null,
      hourly: hr.status === "fulfilled" ? hr.value.data : null,
      daily: dy.status === "fulfilled" ? dy.value.data : null,
      alerts: al.status === "fulfilled" ? al.value.data : null,
    };
    const { system, user } = buildPrompt(type, data);

    bumpUsage(db, req.user.id, day);
    let markdown;
    try {
      markdown = await chat({
        provider: m.provider,
        model: m.model,
        apiBase: (config.api_base || "").trim() || apiBase(),
        apiKey,
        system,
        messages: [{ role: "user", content: user }],
        maxTokens: 4000,
      });
    } catch (err) {
      const msg = err instanceof ProviderError ? err.message : "AI request failed.";
      return fail(msg);
    }

    const info = db.prepare(
      `INSERT INTO ai_reports (user_id, type, location_name, lat, lon, model, markdown, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(req.user.id, type, areaName, loc.lat, loc.lon, m.name, markdown, new Date().toISOString());
    res.redirect(`/ai/reports/${info.lastInsertRowid}`);
  } catch (err) {
    console.error("[ai-analyze]", err && err.message);
    fail("ai.analyzeError");
  }
});

// --- Reports --------------------------------------------------------------
router.get("/ai/reports", requireLogin, (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "", active: "ai" });
  ctx.title = ctx.t("ai.reports");
  let reports = [];
  try {
    reports = db.prepare("SELECT id, type, location_name, model, created_at FROM ai_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.user.id);
  } catch { /* ignore */ }
  res.send(layout(ctx, aiReportsPage(ctx, { reports })));
});

function getReport(db, userId, id) {
  try {
    return db.prepare("SELECT * FROM ai_reports WHERE id = ? AND user_id = ?").get(Number(id), userId) || null;
  } catch {
    return null;
  }
}

router.get("/ai/reports/:id", requireLogin, (req, res) => {
  const db = dbOf(req);
  const report = getReport(db, req.user.id, req.params.id);
  if (!report) return res.redirect("/ai/reports");
  const ctx = pageCtx(req, db, { title: "", active: "ai" });
  ctx.title = ctx.t("ai.reports");
  res.send(layout(ctx, aiReportPage(ctx, { report })));
});

router.post("/ai/reports/:id/delete", requireLogin, (req, res) => {
  const db = dbOf(req);
  try {
    db.prepare("DELETE FROM ai_reports WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user.id);
  } catch { /* ignore */ }
  res.redirect("/ai/reports?ok=ai.deleted");
});

// Print-optimized standalone page (browser Print → Save as PDF renders
// Myanmar script perfectly; server-side PDF libs cannot shape it).
router.get("/ai/reports/:id/print", requireLogin, (req, res) => {
  const db = dbOf(req);
  const report = getReport(db, req.user.id, req.params.id);
  if (!report) return res.redirect("/ai/reports");
  const ctx = pageCtx(req, db, { title: "" });
  res.send(aiPrintPage(ctx, { report }));
});

module.exports = router;

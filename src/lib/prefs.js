// Preference resolution: logged-in users → DB row (overrides cookies);
// guests → cookies. Server always sets cookies so rendering is consistent.
"use strict";

const { isLang } = require("./i18n");

const COOKIES = {
  lang: "mw_lang",
  temp: "mw_temp",
  wind: "mw_wind",
  time: "mw_time",
  theme: "mw_theme",
};

const DEFAULTS = {
  language: "my",
  tempUnit: "c",
  windUnit: "kmh",
  timeFormat: "24",
  theme: "system",
};

const VALID = {
  language: ["my", "en"],
  tempUnit: ["c", "f"],
  windUnit: ["kmh", "mph", "ms"],
  timeFormat: ["12", "24"],
  theme: ["light", "dark", "system"],
};

function clean(v, key) {
  return VALID[key].includes(v) ? v : DEFAULTS[key];
}

/** Resolve effective prefs for the current request. */
function resolvePrefs(req, db) {
  const c = req.cookies || {};
  let prefs = {
    language: clean(c[COOKIES.lang], "language"),
    tempUnit: clean(c[COOKIES.temp], "tempUnit"),
    windUnit: clean(c[COOKIES.wind], "windUnit"),
    timeFormat: clean(c[COOKIES.time], "timeFormat"),
    theme: clean(c[COOKIES.theme], "theme"),
  };
  if (req.user && db) {
    try {
      const row = db
        .prepare("SELECT language, temp_unit, wind_unit, time_format, theme FROM user_preferences WHERE user_id = ?")
        .get(req.user.id);
      if (row) {
        prefs = {
          language: clean(row.language, "language"),
          tempUnit: clean(row.temp_unit, "tempUnit"),
          windUnit: clean(row.wind_unit, "windUnit"),
          timeFormat: clean(row.time_format, "timeFormat"),
          theme: clean(row.theme, "theme"),
        };
      }
    } catch {
      /* fall back to cookies */
    }
  }
  if (!isLang(prefs.language)) prefs.language = "my";
  return prefs;
}

/** Persist prefs: DB for signed-in users; cookies always (guests + render). */
function savePrefs(req, res, db, prefs) {
  if (req.user && db) {
    db.prepare(
      `INSERT INTO user_preferences (user_id, language, temp_unit, wind_unit, time_format, theme)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         language=excluded.language, temp_unit=excluded.temp_unit,
         wind_unit=excluded.wind_unit, time_format=excluded.time_format, theme=excluded.theme`,
    ).run(req.user.id, prefs.language, prefs.tempUnit, prefs.windUnit, prefs.timeFormat, prefs.theme);
  }
  const opts = { path: "/", maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: "lax" };
  res.cookie(COOKIES.lang, prefs.language, opts);
  res.cookie(COOKIES.temp, prefs.tempUnit, opts);
  res.cookie(COOKIES.wind, prefs.windUnit, opts);
  res.cookie(COOKIES.time, prefs.timeFormat, opts);
  res.cookie(COOKIES.theme, prefs.theme, opts);
}

module.exports = { COOKIES, DEFAULTS, resolvePrefs, savePrefs };

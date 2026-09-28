// Hand-rolled server-side validation (Tech Stack 2: no zod).
// Each validator returns { ok: true, value } or { ok: false, error }.
"use strict";

function fail(error) {
  return { ok: false, error };
}
function pass(value) {
  return { ok: true, value };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function email(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!EMAIL_RE.test(s) || s.length > 254) return fail("invalidEmail");
  return pass(s);
}

function password(v) {
  const s = String(v || "");
  if (s.length < 8 || s.length > 128) return fail("passwordTooShort");
  return pass(s);
}

function name(v, max = 80) {
  const s = String(v || "").trim();
  if (s.length > max) return fail("tooLong");
  return pass(s);
}

function num(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return fail("outOfRange");
  return pass(n);
}

function coords(lat, lon) {
  const la = num(lat, -90, 90);
  if (!la.ok) return la;
  const lo = num(lon, -180, 180);
  if (!lo.ok) return lo;
  return pass({ lat: la.value, lon: lo.value });
}

function query(v, max = 100) {
  const s = String(v || "").trim();
  if (!s || s.length > max) return fail("invalidQuery");
  return pass(s);
}

function text(v, { max = 5000, min = 1 } = {}) {
  const s = String(v || "").trim();
  if (s.length < min || s.length > max) return fail("invalidText");
  return pass(s);
}

const ENUMS = {
  lang: ["my", "en"],
  tempUnit: ["c", "f"],
  windUnit: ["kmh", "mph", "ms"],
  timeFormat: ["12", "24"],
  theme: ["light", "dark", "system"],
  severity: ["advisory", "watch", "warning", "emergency"],
  role: ["user", "admin"],
};

function enumOf(v, which) {
  const s = String(v || "");
  if (!ENUMS[which].includes(s)) return fail("invalidEnum");
  return pass(s);
}

function favoriteBody(body) {
  const nameEn = text(body.nameEn, { max: 120 });
  if (!nameEn.ok) return nameEn;
  const c = coords(body.lat, body.lon);
  if (!c.ok) return c;
  const opt = (v, max = 120) => String(v || "").trim().slice(0, max);
  const locId = body.locationId ? String(body.locationId).trim().slice(0, 64) : null;
  return pass({
    locationId: locId,
    nameEn: nameEn.value,
    nameMy: opt(body.nameMy),
    stateEn: opt(body.stateEn),
    stateMy: opt(body.stateMy),
    lat: c.value.lat,
    lon: c.value.lon,
  });
}

function prefsBody(body) {
  const language = enumOf(body.language, "lang");
  if (!language.ok) return language;
  const tempUnit = enumOf(body.tempUnit, "tempUnit");
  if (!tempUnit.ok) return tempUnit;
  const windUnit = enumOf(body.windUnit, "windUnit");
  if (!windUnit.ok) return windUnit;
  const timeFormat = enumOf(body.timeFormat, "timeFormat");
  if (!timeFormat.ok) return timeFormat;
  const theme = enumOf(body.theme, "theme");
  if (!theme.ok) return theme;
  return pass({
    language: language.value,
    tempUnit: tempUnit.value,
    windUnit: windUnit.value,
    timeFormat: timeFormat.value,
    theme: theme.value,
  });
}

function subscriptionBody(body) {
  const nameEn = text(body.nameEn, { max: 120 });
  if (!nameEn.ok) return nameEn;
  const c = coords(body.lat, body.lon);
  if (!c.ok) return c;
  const sev = enumOf(body.severityThreshold || body.minSeverity, "severity");
  if (!sev.ok) return sev;
  return pass({
    nameEn: nameEn.value,
    lat: c.value.lat,
    lon: c.value.lon,
    severityThreshold: sev.value,
  });
}

function announcementBody(body) {
  const titleMy = text(body.titleMy, { max: 200 });
  if (!titleMy.ok) return titleMy;
  const titleEn = text(body.titleEn, { max: 200 });
  if (!titleEn.ok) return titleEn;
  const bodyMy = text(body.bodyMy, { max: 5000 });
  if (!bodyMy.ok) return bodyMy;
  const bodyEn = text(body.bodyEn, { max: 5000 });
  if (!bodyEn.ok) return bodyEn;
  const sev = enumOf(body.severity || "advisory", "severity");
  if (!sev.ok) return sev;
  return pass({
    titleMy: titleMy.value,
    titleEn: titleEn.value,
    bodyMy: bodyMy.value,
    bodyEn: bodyEn.value,
    severity: sev.value,
    isPublished: body.isPublished === "1" || body.isPublished === true,
  });
}

module.exports = {
  email,
  password,
  name,
  num,
  coords,
  query,
  text,
  enumOf,
  favoriteBody,
  prefsBody,
  subscriptionBody,
  announcementBody,
  ENUMS,
};

// Formatting helpers. All dates/times render in Asia/Yangon. Pure functions.
"use strict";

const YANGON_TZ = "Asia/Yangon";

function localeFor(lang) {
  // Force Latin digits (nu-latn): familiar in Myanmar apps, avoids layout surprises.
  return lang === "my" ? "my-MM-u-nu-latn" : "en-GB";
}

function toTemp(tempC, unit) {
  return unit === "f" ? (tempC * 9) / 5 + 32 : tempC;
}

function formatTemp(tempC, unit) {
  const v = toTemp(tempC, unit);
  return `${Math.round(v)}°${unit === "f" ? "F" : "C"}`;
}

function formatWind(windKmh, unit) {
  if (unit === "mph") return Math.round(windKmh / 1.60934);
  if (unit === "ms") return (windKmh / 3.6).toFixed(1);
  return Math.round(windKmh);
}

function formatTime(iso, lang, timeFormat) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: YANGON_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12",
  }).format(new Date(iso));
}

function formatHourLabel(iso, lang, timeFormat) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: YANGON_TZ,
    hour: "numeric",
    hour12: timeFormat === "12",
  }).format(new Date(iso));
}

function formatDate(iso, lang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: YANGON_TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function formatWeekday(iso, lang, style = "short") {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: YANGON_TZ,
    weekday: style,
  }).format(new Date(iso));
}

function formatDateTime(iso, lang, timeFormat) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: YANGON_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12",
  }).format(new Date(iso));
}

const COMPASS_KEYS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function compassKey(deg) {
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return COMPASS_KEYS[idx];
}

function uvBand(uv) {
  if (uv == null) return null;
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "veryHigh";
  return "extreme";
}

function formatVisibility(m, t) {
  if (m == null) return "—";
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ${t("common.km")}`;
}

/** HTML-escape a value for safe interpolation into templates. */
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  YANGON_TZ,
  localeFor,
  toTemp,
  formatTemp,
  formatWind,
  formatTime,
  formatHourLabel,
  formatDate,
  formatWeekday,
  formatDateTime,
  compassKey,
  uvBand,
  formatVisibility,
  esc,
};

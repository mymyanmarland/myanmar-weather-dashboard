// Snapshot builder: capture the full structured weather snapshot used for a
// report's prompt, plus the matched Myanmar climate zone. Report views render
// KPI cards, charts, and tables from this snapshot without re-calling
// providers. Stored as JSON in ai_reports.data_json.
"use strict";

const { ZONES, MONTHS_EN, MONTHS_MY } = require("./climate-knowledge");

// Representative anchor points for each climate zone (documented heuristic;
// used only to pick the closest climatological normals for context).
const ZONE_ANCHORS = {
  rakhine: { lat: 20.14, lon: 92.9 }, // Sittwe
  delta: { lat: 16.84, lon: 96.17 }, // Yangon
  dryzone: { lat: 21.97, lon: 96.08 }, // Mandalay
  shan: { lat: 20.79, lon: 97.04 }, // Taunggyi
  north: { lat: 25.38, lon: 97.39 }, // Myitkyina
  tanintharyi: { lat: 14.08, lon: 98.2 }, // Dawei
};

function haversineKm(aLat, aLon, bLat, bLon) {
  const r = (d) => (d * Math.PI) / 180;
  const s1 = Math.sin(r(bLat - aLat) / 2);
  const s2 = Math.sin(r(bLon - aLon) / 2);
  const a = s1 * s1 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * s2 * s2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Pick the closest climate zone for a lat/lon (approximate, documented). */
function matchZone(lat, lon) {
  let best = "delta";
  let bestD = Infinity;
  for (const [id, p] of Object.entries(ZONE_ANCHORS)) {
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return ZONES.find((z) => z.id === best) || ZONES[1];
}

/** Myanmar season for a month index (0=Jan): summer / monsoon / winter. */
function seasonForMonth(mi) {
  if (mi >= 2 && mi <= 4) return { en: "Summer (hot season)", my: "နွေရာသီ" };
  if (mi >= 5 && mi <= 8) return { en: "Southwest monsoon", my: "အနောက်တောင်မုတ်သုန်မိုးရာသီ" };
  return { en: "Winter (NE monsoon)", my: "ဆောင်းရာသီ" };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yangonString(iso) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Yangon",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Build the report snapshot. `data` = {loc, current, hourly, daily, alerts}
 * as passed to buildPrompt. Never throws on missing pieces — fields fall back
 * to null so views can degrade gracefully.
 */
function buildSnapshot(data, type) {
  const loc = data.loc || {};
  const now = new Date();
  const nowIso = now.toISOString();
  const mi = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", month: "numeric" }).format(now),
  ) - 1;
  const zone = matchZone(Number(loc.lat) || 16.84, Number(loc.lon) || 96.17);
  const season = seasonForMonth(mi);

  const c = data.current || {};
  const hourly = Array.isArray(data.hourly) ? data.hourly.slice(0, 24) : [];
  const daily = Array.isArray(data.daily) ? data.daily.slice(0, 7) : [];
  const alerts = Array.isArray(data.alerts) ? data.alerts.slice(0, 10) : [];

  return {
    version: 1,
    type,
    location: {
      nameEn: loc.nameEn || "",
      nameMy: loc.nameMy || "",
      lat: num(loc.lat),
      lon: num(loc.lon),
    },
    generatedAt: nowIso,
    generatedAtYangon: yangonString(nowIso),
    monthIndex: mi,
    monthEn: MONTHS_EN[mi],
    monthMy: MONTHS_MY[mi],
    current: data.current
      ? {
          temperatureC: num(c.temperatureC),
          feelsLikeC: num(c.feelsLikeC),
          humidity: num(c.humidity),
          pressureHpa: num(c.pressureHpa),
          windKmh: num(c.windKmh),
          windDirectionDeg: num(c.windDirectionDeg),
          weatherCode: c.weatherCode ?? null,
          isDay: !!c.isDay,
          uvIndex: num(c.uvIndex),
          precipitationMm: num(c.precipitationMm),
          highC: num(c.highC),
          lowC: num(c.lowC),
          sunrise: c.sunrise || null,
          sunset: c.sunset || null,
        }
      : null,
    hourly: hourly.map((h) => ({
      time: h.time || null,
      temperatureC: num(h.temperatureC),
      precipitationProb: num(h.precipitationProb),
      precipitationMm: num(h.precipitationMm),
      weatherCode: h.weatherCode ?? null,
      windKmh: num(h.windKmh),
      isDay: !!h.isDay,
    })),
    daily: daily.map((d) => ({
      date: d.date || null,
      weatherCode: d.weatherCode ?? null,
      highC: num(d.highC),
      lowC: num(d.lowC),
      precipitationProb: num(d.precipitationProb),
      precipitationMm: num(d.precipitationMm),
      windKmh: num(d.windKmh),
    })),
    alerts: alerts.map((a) => ({
      severity: a.severity || "info",
      title: String(a.title || a.event || "Weather alert").slice(0, 140),
      description: String(a.description || a.text || "").slice(0, 400),
    })),
    climate: {
      zoneId: zone.id,
      zoneEn: zone.en,
      zoneMy: zone.my,
      seasonEn: season.en,
      seasonMy: season.my,
      normalTempC: zone.temp[mi],
      normalRainMm: zone.rain[mi],
    },
  };
}

/** Parse a stored snapshot; returns null for legacy/empty/corrupt rows. */
function parseSnapshot(dataJson) {
  if (!dataJson) return null;
  try {
    const s = JSON.parse(dataJson);
    if (!s || s.version !== 1 || !Array.isArray(s.daily)) return null;
    return s;
  } catch {
    return null;
  }
}

module.exports = { buildSnapshot, parseSnapshot, matchZone };

// MET Norway Locationforecast — backup weather provider.
//
// Used automatically when the primary Open-Meteo provider fails (e.g. its
// free API 429-throttles our hosting provider's shared egress IPs).
// Free, no API key, global coverage. Times are UTC; we convert to
// Asia/Yangon (fixed +6:30, no DST) for daily grouping.
// Docs: https://api.met.no/doc/locationforecast/
"use strict";

const { deriveAlerts } = require("./codes");

const API_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const USER_AGENT =
  "myanmar-weather-dashboard-ts2/1.0 (github.com/mymyanmarland/myanmar-weather-dashboard)";
const YANGON_OFFSET_MS = 6.5 * 3600 * 1000;
const TS_TTL_MS = 10 * 60 * 1000;

// MET symbol_code base (without _day/_night/_polartwilight suffix) -> WMO code
const SYMBOL_TO_WMO = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrainshowers: 80,
  rainshowers: 80,
  heavyrainshowers: 81,
  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightsleetshowers: 80,
  sleetshowers: 80,
  heavysleetshowers: 81,
  lightsleet: 71,
  sleet: 73,
  heavysleet: 75,
  lightsnowshowers: 85,
  snowshowers: 85,
  heavysnowshowers: 86,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  thunder: 95,
  lightrainandthunder: 95,
  rainandthunder: 95,
  lightrainshowersandthunder: 95,
  rainshowersandthunder: 95,
  lightsnowandthunder: 95,
  snowandthunder: 95,
  lightsleetandthunder: 95,
};

// Rough severity rank so a day's "headline" symbol is the worst condition.
const WMO_SEVERITY = {
  95: 100, 96: 100, 99: 100,
  65: 90, 81: 88, 82: 88, 75: 85, 86: 85,
  63: 80, 80: 78, 73: 75, 85: 75,
  61: 70, 71: 65, 77: 65, 66: 60, 67: 60,
  45: 50, 48: 50, 55: 45, 53: 42, 51: 40, 56: 40, 57: 40,
  3: 30, 2: 20, 1: 10, 0: 0,
};

// Polite module-level cache: one timeseries fetch serves
// getCurrentWeather + getHourlyForecast + getDailyForecast together.
const tsCache = new Map(); // "lat,lon" -> { data, expiresAt }

async function getTimeseries(loc) {
  const k = `${Number(loc.lat).toFixed(3)},${Number(loc.lon).toFixed(3)}`;
  const now = Date.now();
  const hit = tsCache.get(k);
  if (hit && hit.expiresAt > now) return hit.data;
  const url = `${API_URL}?lat=${Number(loc.lat).toFixed(4)}&lon=${Number(loc.lon).toFixed(4)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: ctl.signal });
    if (!res.ok) throw new Error(`MET Norway request failed: ${res.status}`);
    const json = await res.json();
    const ts = (json.properties && json.properties.timeseries) || [];
    if (!ts.length) throw new Error("MET Norway returned no timeseries");
    tsCache.set(k, { data: ts, expiresAt: now + TS_TTL_MS });
    return ts;
  } finally {
    clearTimeout(timer);
  }
}

function symbolOf(entry) {
  const d = entry.data || {};
  return (
    (d.next_1_hours && d.next_1_hours.summary && d.next_1_hours.summary.symbol_code) ||
    (d.next_6_hours && d.next_6_hours.summary && d.next_6_hours.summary.symbol_code) ||
    (d.next_12_hours && d.next_12_hours.summary && d.next_12_hours.summary.symbol_code) ||
    null
  );
}

function baseSymbol(sym) {
  return sym ? sym.replace(/_(day|night|polartwilight)$/, "") : null;
}

function wmoOf(entry) {
  const wmo = SYMBOL_TO_WMO[baseSymbol(symbolOf(entry))];
  if (wmo != null) return wmo;
  // Unknown symbol: fall back to cloud cover.
  const det = (entry.data && entry.data.instant && entry.data.instant.details) || {};
  const c = det.cloud_area_fraction;
  if (c == null) return 3;
  if (c >= 87.5) return 3;
  if (c >= 50) return 2;
  if (c >= 12.5) return 1;
  return 0;
}

function isDayFromSymbol(sym) {
  if (!sym) return null;
  if (sym.endsWith("_day")) return true;
  if (sym.endsWith("_night")) return false;
  return null;
}

function localHour(isoUtc) {
  return new Date(new Date(isoUtc).getTime() + YANGON_OFFSET_MS).getUTCHours();
}

function localDateKey(isoUtc) {
  return new Date(new Date(isoUtc).getTime() + YANGON_OFFSET_MS).toISOString().slice(0, 10);
}

function entryIsDay(entry) {
  const fromSym = isDayFromSymbol(symbolOf(entry));
  if (fromSym !== null) return fromSym;
  const h = localHour(entry.time);
  return h >= 6 && h < 18;
}

/** Apparent temperature (BOM/Steadman); falls back to air temp. */
function apparentTemp(tC, dewC, windMs) {
  if (tC == null) return null;
  if (dewC == null || windMs == null) return tC;
  const e = 6.105 * Math.exp((17.27 * dewC) / (237.7 + dewC));
  return tC + 0.33 * e - 0.7 * windMs - 4.0;
}

function precipMm(entry) {
  const d = entry.data || {};
  const n1 = d.next_1_hours && d.next_1_hours.details;
  if (n1 && n1.precipitation_amount != null) return n1.precipitation_amount;
  const n6 = d.next_6_hours && d.next_6_hours.details;
  if (n6 && n6.precipitation_amount != null) return n6.precipitation_amount / 6;
  return 0;
}

/** Sunrise/sunset from the provider's own day/night transitions (hourly). */
function findSunTimes(ts, dateKey) {
  let sunrise = null;
  let sunset = null;
  let prev = null;
  for (const e of ts) {
    if (localDateKey(e.time) !== dateKey) continue;
    const day = entryIsDay(e);
    if (prev === false && day === true && !sunrise) sunrise = e.time;
    if (prev === true && day === false && !sunset) sunset = e.time;
    prev = day;
  }
  // Myanmar-safe fallback (never null: views format these unconditionally).
  if (!sunrise) sunrise = `${dateKey}T06:00:00+06:30`;
  if (!sunset) sunset = `${dateKey}T18:00:00+06:30`;
  return { sunrise, sunset };
}

function currentEntry(ts) {
  const cutoff = Date.now() - 30 * 60 * 1000;
  return ts.find((e) => new Date(e.time).getTime() >= cutoff) || null;
}

const metNoProvider = {
  async getCurrentWeather(loc) {
    const ts = await getTimeseries(loc);
    const entry = currentEntry(ts);
    if (!entry) throw new Error("MET Norway: no current entry");
    const det = entry.data.instant.details || {};
    const dateKey = localDateKey(entry.time);
    let highC = det.air_temperature;
    let lowC = det.air_temperature;
    for (const e of ts) {
      if (localDateKey(e.time) !== dateKey) continue;
      const t = e.data.instant.details.air_temperature;
      if (t == null) continue;
      if (t > highC) highC = t;
      if (t < lowC) lowC = t;
    }
    const { sunrise, sunset } = findSunTimes(ts, dateKey);
    return {
      temperatureC: det.air_temperature,
      feelsLikeC: apparentTemp(det.air_temperature, det.dew_point_temperature, det.wind_speed),
      humidity: det.relative_humidity != null ? Math.round(det.relative_humidity) : null,
      pressureHpa: det.air_pressure_at_sea_level,
      windKmh: det.wind_speed != null ? det.wind_speed * 3.6 : null,
      windDirectionDeg: det.wind_from_direction,
      weatherCode: wmoOf(entry),
      isDay: entryIsDay(entry),
      visibilityM: null,
      uvIndex: null,
      precipitationMm: precipMm(entry),
      precipitationProb: null,
      highC,
      lowC,
      sunrise,
      sunset,
      observedAt: entry.time,
    };
  },

  async getHourlyForecast(loc) {
    const ts = await getTimeseries(loc);
    const cutoff = Date.now() - 30 * 60 * 1000;
    const points = [];
    for (const e of ts) {
      if (new Date(e.time).getTime() < cutoff) continue;
      if (points.length >= 24) break;
      const det = e.data.instant.details || {};
      points.push({
        time: e.time,
        temperatureC: det.air_temperature,
        precipitationProb: null,
        precipitationMm: precipMm(e),
        weatherCode: wmoOf(e),
        windKmh: det.wind_speed != null ? det.wind_speed * 3.6 : null,
        humidity: det.relative_humidity != null ? Math.round(det.relative_humidity) : null,
        isDay: entryIsDay(e),
      });
    }
    return points;
  },

  async getDailyForecast(loc) {
    const ts = await getTimeseries(loc);
    const byDay = new Map();
    for (const e of ts) {
      const dk = localDateKey(e.time);
      if (!byDay.has(dk)) byDay.set(dk, []);
      byDay.get(dk).push(e);
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 7);
    return days.map(([date, entries]) => {
      let highC = -Infinity;
      let lowC = Infinity;
      let precip = 0;
      let windMax = 0;
      let bestWmo = 0;
      let bestSev = -1;
      for (const e of entries) {
        const det = e.data.instant.details || {};
        if (det.air_temperature != null) {
          if (det.air_temperature > highC) highC = det.air_temperature;
          if (det.air_temperature < lowC) lowC = det.air_temperature;
        }
        precip += precipMm(e);
        if (det.wind_speed != null && det.wind_speed * 3.6 > windMax) windMax = det.wind_speed * 3.6;
        const w = wmoOf(e);
        const sev = WMO_SEVERITY[w] != null ? WMO_SEVERITY[w] : 25;
        if (sev > bestSev) {
          bestSev = sev;
          bestWmo = w;
        }
      }
      const { sunrise, sunset } = findSunTimes(ts, date);
      return {
        date,
        weatherCode: bestWmo,
        highC: highC === -Infinity ? null : highC,
        lowC: lowC === Infinity ? null : lowC,
        precipitationProb: null,
        precipitationMm: Math.round(precip * 10) / 10,
        windKmh: Math.round(windMax * 10) / 10,
        sunrise,
        sunset,
      };
    });
  },

  async getWeatherAlerts(loc, areaName) {
    const [current, daily] = await Promise.all([
      this.getCurrentWeather(loc),
      this.getDailyForecast(loc),
    ]);
    return deriveAlerts({ current, daily, areaName });
  },
};

module.exports = { metNoProvider };

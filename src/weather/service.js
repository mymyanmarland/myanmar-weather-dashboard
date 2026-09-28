// Weather service: cached server-side reads with last-known-good fallback.
// Revalidation windows: current 10 min, forecasts 1 h, alerts 30 min.
// On provider failure the last successful result is returned with
// `stale: true` so pages show a clear stale-data indicator (spec §3.14)
// instead of an error wall. Every attempt is logged to weather_fetch_log.
"use strict";

const { openMeteoProvider, geocodeSearch } = require("./open-meteo");

const TTL = {
  current: 10 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 60 * 60 * 1000,
  alerts: 30 * 60 * 1000,
};

let provider = openMeteoProvider;
let db = null;

function setDb(database) {
  db = database;
}

/** Test hook: swap the provider to simulate failures. */
function setProvider(p) {
  provider = p || openMeteoProvider;
}

// In-memory hot cache + last-known-good store.
const cache = new Map(); // key -> { data, fetchedAt, expiresAt }

function key(kind, loc) {
  return `${kind}:${Number(loc.lat).toFixed(3)},${Number(loc.lon).toFixed(3)}`;
}

function logFetch(kind, locationKey, ok, error) {
  if (!db) return;
  try {
    db.prepare(
      "INSERT INTO weather_fetch_log (kind, location_key, fetched_at, ok, error) VALUES (?, ?, ?, ?, ?)",
    ).run(kind, locationKey, new Date().toISOString(), ok ? 1 : 0, error || null);
    // Keep the log bounded.
    db.prepare(
      "DELETE FROM weather_fetch_log WHERE id NOT IN (SELECT id FROM weather_fetch_log ORDER BY id DESC LIMIT 300)",
    ).run();
  } catch {
    /* logging must never break the request */
  }
}

// In-flight dedup: concurrent requests for the same key share one provider
// fetch instead of each firing their own (e.g. the home page asks for
// current+daily directly AND via getWeatherAlerts at the same time).
const inflight = new Map(); // key -> Promise

async function withCache(kind, loc, fetcher) {
  const k = key(kind, loc);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && hit.expiresAt > now) {
    return { data: hit.data, fetchedAt: hit.fetchedAt, stale: false };
  }
  const ongoing = inflight.get(k);
  if (ongoing) return ongoing;
  const p = (async () => {
    try {
      const data = await fetcher();
      const fetchedAt = new Date().toISOString();
      cache.set(k, { data, fetchedAt, expiresAt: Date.now() + TTL[kind] });
      logFetch(kind, k, true, null);
      return { data, fetchedAt, stale: false };
    } catch (err) {
      logFetch(kind, k, false, String((err && err.message) || err));
      const lastGood = cache.get(k);
      if (lastGood) {
        // Last-known-good fallback, clearly marked stale.
        return { data: lastGood.data, fetchedAt: lastGood.fetchedAt, stale: true };
      }
      throw err;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

function getCurrentWeather(loc) {
  return withCache("current", loc, () => provider.getCurrentWeather(loc));
}

function getHourlyForecast(loc) {
  return withCache("hourly", loc, () => provider.getHourlyForecast(loc));
}

function getDailyForecast(loc) {
  return withCache("daily", loc, () => provider.getDailyForecast(loc));
}

function getWeatherAlerts(loc, areaName) {
  return withCache("alerts", loc, () => provider.getWeatherAlerts(loc, areaName));
}

/** Current conditions for the national overview (12 cities), in parallel. */
async function getOverview(cities) {
  const results = await Promise.all(
    cities.map(async (city) => {
      try {
        const r = await getCurrentWeather({ lat: city.lat, lon: city.lon });
        return { city, current: r.data, fetchedAt: r.fetchedAt, stale: r.stale, error: null };
      } catch (err) {
        return { city, current: null, fetchedAt: null, stale: false, error: String((err && err.message) || err) };
      }
    }),
  );
  return results;
}

function recentFetches(limit = 20) {
  if (!db) return [];
  return db
    .prepare("SELECT kind, location_key, fetched_at, ok, error FROM weather_fetch_log ORDER BY id DESC LIMIT ?")
    .all(limit);
}

function clearCache() {
  cache.clear();
}

module.exports = {
  setDb,
  setProvider,
  clearCache,
  getCurrentWeather,
  getHourlyForecast,
  getDailyForecast,
  getWeatherAlerts,
  getOverview,
  recentFetches,
  geocodeSearch,
};

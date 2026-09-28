// Open-Meteo provider. Free, no API key. All requests run server-side only.
// Times are requested in Asia/Yangon so views never guess a timezone.
"use strict";

const { deriveAlerts } = require("./codes");

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const TZ = "Asia/Yangon";

async function omFetch(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "myanmar-weather-dashboard-ts2/1.0" },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function coords(q) {
  return `latitude=${q.lat.toFixed(4)}&longitude=${q.lon.toFixed(4)}`;
}

function first(arr, i = 0) {
  return arr ? arr[i] : undefined;
}

const openMeteoProvider = {
  async getCurrentWeather(loc) {
    const url =
      `${FORECAST_URL}?${coords(loc)}&timezone=${encodeURIComponent(TZ)}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index` +
      `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=1&wind_speed_unit=kmh`;
    const json = await omFetch(url);
    const c = json.current || {};
    const d = json.daily || {};
    return {
      temperatureC: c.temperature_2m,
      feelsLikeC: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      pressureHpa: c.pressure_msl,
      windKmh: c.wind_speed_10m,
      windDirectionDeg: c.wind_direction_10m,
      weatherCode: c.weather_code,
      isDay: c.is_day === 1,
      visibilityM: c.visibility != null ? c.visibility : null,
      uvIndex: c.uv_index != null ? c.uv_index : null,
      precipitationMm: c.precipitation != null ? c.precipitation : 0,
      precipitationProb: null, // filled by service from hourly when available
      highC: first(d.temperature_2m_max) != null ? first(d.temperature_2m_max) : c.temperature_2m,
      lowC: first(d.temperature_2m_min) != null ? first(d.temperature_2m_min) : c.temperature_2m,
      sunrise: first(d.sunrise) || c.time,
      sunset: first(d.sunset) || c.time,
      observedAt: c.time,
    };
  },

  async getHourlyForecast(loc) {
    const url =
      `${FORECAST_URL}?${coords(loc)}&timezone=${encodeURIComponent(TZ)}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
      `&forecast_days=2&wind_speed_unit=kmh`;
    const json = await omFetch(url);
    const h = json.hourly || {};
    const now = Date.now();
    const points = [];
    const times = h.time || [];
    for (let i = 0; i < times.length && points.length < 24; i++) {
      const t = new Date(times[i]).getTime();
      if (t < now - 30 * 60 * 1000) continue; // skip hours well in the past
      points.push({
        time: times[i],
        temperatureC: h.temperature_2m[i],
        precipitationProb: h.precipitation_probability[i],
        precipitationMm: h.precipitation[i],
        weatherCode: h.weather_code[i],
        windKmh: h.wind_speed_10m[i],
        humidity: h.relative_humidity_2m[i],
        isDay: h.is_day[i] === 1,
      });
    }
    return points;
  },

  async getDailyForecast(loc) {
    const url =
      `${FORECAST_URL}?${coords(loc)}&timezone=${encodeURIComponent(TZ)}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=7&wind_speed_unit=kmh`;
    const json = await omFetch(url);
    const d = json.daily || {};
    const times = d.time || [];
    return times.map((date, i) => ({
      date,
      weatherCode: d.weather_code[i],
      highC: d.temperature_2m_max[i],
      lowC: d.temperature_2m_min[i],
      precipitationProb: d.precipitation_probability_max[i],
      precipitationMm: d.precipitation_sum[i],
      windKmh: d.wind_speed_10m_max[i],
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
    }));
  },

  async getWeatherAlerts(loc, areaName) {
    const [current, daily] = await Promise.all([
      this.getCurrentWeather(loc),
      this.getDailyForecast(loc),
    ]);
    return deriveAlerts({ current, daily, areaName });
  },
};

// ---------------------------------------------------------------------------
// Geocoding (used by the search page; server-side only)
// ---------------------------------------------------------------------------

async function geocodeSearch(query, count = 8) {
  const url =
    `${GEOCODING_URL}?name=${encodeURIComponent(query)}` +
    `&count=${count}&language=en&format=json&countryCode=MM`;
  const json = await omFetch(url);
  return (json.results || []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    countryCode: r.country_code || null,
    admin1: r.admin1 || null,
    admin2: r.admin2 || null,
    admin3: r.admin3 || null,
  }));
}

module.exports = { openMeteoProvider, geocodeSearch, TZ };

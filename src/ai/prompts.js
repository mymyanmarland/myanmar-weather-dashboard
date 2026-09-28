// Prompt builders: ground every AI analysis on REAL observed/forecast data
// from the weather service plus the Myanmar climate knowledge base.
// Output contract: bilingual Markdown — "## မြန်မာ" section first, then
// "## English". The model must not invent observations.
"use strict";

const { toPromptText } = require("./climate-knowledge");

const TYPES = ["weather-prediction", "climate-prediction", "analysis"];

function fmt(n, digits = 1) {
  return n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);
}

function dataBlock({ loc, current, hourly, daily, alerts }) {
  const L = [];
  L.push(`Location: ${loc.nameEn || ""}${loc.nameMy ? " / " + loc.nameMy : ""} (${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)})`);
  L.push(`Report time: ${new Date().toISOString()} (UTC)`);
  L.push("");
  if (current) {
    const c = current;
    L.push("CURRENT CONDITIONS (observed/forecast now):");
    L.push(`- temperature ${fmt(c.temperatureC)}°C, feels like ${fmt(c.feelsLikeC)}°C`);
    L.push(`- humidity ${fmt(c.humidity, 0)}%, pressure ${fmt(c.pressureHpa, 0)} hPa`);
    L.push(`- wind ${fmt(c.windKmh)} km/h${c.windDirectionDeg != null ? ` from ${Math.round(c.windDirectionDeg)}°` : ""}`);
    L.push(`- weather code ${c.weatherCode}, is_day=${c.isDay}`);
    L.push(`- precipitation ${fmt(c.precipitationMm)} mm, visibility ${c.visibilityM != null ? Math.round(c.visibilityM / 1000) + " km" : "—"}, UV index ${fmt(c.uvIndex)}`);
    L.push(`- today's high ${fmt(c.highC)}°C / low ${fmt(c.lowC)}°C, sunrise ${c.sunrise || "—"}, sunset ${c.sunset || "—"}`);
  } else {
    L.push("CURRENT CONDITIONS: unavailable (provider error).");
  }
  L.push("");
  if (hourly && hourly.length) {
    L.push("NEXT 24 HOURS (hourly: time, temp °C, rain %, mm, weather code):");
    for (const h of hourly.slice(0, 24)) {
      L.push(`- ${h.time}: ${fmt(h.temperatureC)}°C, rain ${fmt(h.precipitationProb, 0)}%/${fmt(h.precipitationMm)}mm, code ${h.weatherCode}, wind ${fmt(h.windKmh)} km/h`);
    }
  } else {
    L.push("HOURLY: unavailable.");
  }
  L.push("");
  if (daily && daily.length) {
    L.push("7-DAY DAILY (date, code, high/low °C, rain %/mm, max wind km/h):");
    for (const d of daily.slice(0, 7)) {
      L.push(`- ${d.date}: code ${d.weatherCode}, ${fmt(d.highC)}/${fmt(d.lowC)}°C, rain ${fmt(d.precipitationProb, 0)}%/${fmt(d.precipitationMm)}mm, wind ${fmt(d.windKmh)} km/h`);
    }
  } else {
    L.push("DAILY: unavailable.");
  }
  L.push("");
  if (alerts && alerts.length) {
    L.push("ACTIVE WEATHER ALERTS:");
    for (const a of alerts) {
      L.push(`- [${a.severity || "info"}] ${a.title || a.event || "alert"}: ${String(a.description || a.text || "").slice(0, 300)}`);
    }
  } else {
    L.push("ACTIVE WEATHER ALERTS: none.");
  }
  return L.join("\n");
}

const SYSTEM = `You are a Myanmar climate and weather analyst writing for the general public in Myanmar.
Rules:
- Ground EVERY claim in the DATA block and the CLIMATE KNOWLEDGE block. Never invent observations, measurements, or alerts.
- Climate-knowledge values are long-term normals (approximate), not live data — say so when you use them ("compared with the usual ~X for this month").
- Be specific to the location's climate zone. Mention confidence (high/medium/low) for predictions.
- Practical, safety-first advice: flooding, heat, storms, farming, travel, daily life.
- OUTPUT FORMAT (strict): Markdown only. Start with "## မြန်မာ" containing the full analysis in Burmese, then "## English" with the same analysis in English. Use headings, short paragraphs, and bullet lists. No other top-level sections.`;

const TYPE_INSTRUCTIONS = {
  "weather-prediction": `TASK: 7-day weather prediction for the location.
Cover: day-by-day narrative (temperature trend, rain chances, wind), a detailed next-24-hours breakdown, notable risks (heavy rain, storms, heat), and confidence notes per period.`,
  "climate-prediction": `TASK: Climate / seasonal outlook for the location.
Cover: where the location sits in Myanmar's seasonal cycle right now, how current conditions compare with climatological normals for this month, the anomaly discussion (wetter/drier/hotter/cooler than usual and why it matters), the outlook for the coming weeks-to-month in the context of monsoon onset/withdrawal and cyclone windows, and what to watch (El Niño/La Niña influence, flood or drought risk). Be explicit that this is an outlook, not a deterministic forecast.`,
  "analysis": `TASK: Deep-dive analysis of current weather conditions at the location.
Cover: what is happening now and why (plain-language explanation), risks in the next 48 hours (flooding, heat, wind/storms), who is most affected, and practical advice sections for farmers, travelers, and daily life. End with a short "what to watch next" list.`,
};

/**
 * Build {system, user} prompt. `data` = {loc, current, hourly, daily, alerts}.
 * Throws when the type is unknown.
 */
function buildPrompt(type, data) {
  if (!TYPES.includes(type)) throw new Error(`unknown analysis type: ${type}`);
  const user = [
    TYPE_INSTRUCTIONS[type],
    "",
    "=== DATA (live service output) ===",
    dataBlock(data),
    "",
    "=== CLIMATE KNOWLEDGE ===",
    toPromptText(),
    "",
    "Write the bilingual Markdown analysis now.",
  ].join("\n");
  return { system: SYSTEM, user };
}

module.exports = { TYPES, buildPrompt };

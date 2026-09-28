// Maps WMO weather codes → sky theme keys used for the dynamic,
// weather-reactive page background (body.sky-<theme>) and hero styling.
// Theme format: "<base>-day" | "<base>-night".
"use strict";

function skyBase(code) {
  const c = Number(code);
  if (c === 0 || c === 1) return "clear";
  if (c === 2) return "partly";
  if (c === 3) return "cloudy";
  if (c === 45 || c === 48) return "fog";
  if (c >= 51 && c <= 57) return "drizzle";
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c >= 95) return "storm";
  return "cloudy";
}

/** e.g. skyTheme(61, true) → "rain-day". */
function skyTheme(code, isDay) {
  return `${skyBase(code)}-${isDay === false ? "night" : "day"}`;
}

/**
 * Fixed full-viewport animated background layer. Rendered once near the top
 * of <main> on the home page; CSS shows only the layers relevant to the
 * active body.sky-<theme> class. Pure CSS animation; disabled under
 * prefers-reduced-motion.
 */
function skyFx() {
  return `<div class="skyfx" aria-hidden="true">
    <div class="fx fx-sun"></div>
    <div class="fx fx-cloud fx-c1"></div>
    <div class="fx fx-cloud fx-c2"></div>
    <div class="fx fx-cloud fx-c3"></div>
    <div class="fx fx-stars"></div>
    <div class="fx fx-snow"></div>
    <div class="fx fx-bolt"></div>
  </div>`;
}

module.exports = { skyTheme, skyBase, skyFx };

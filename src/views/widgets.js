// Reusable HTML fragments for weather display.
"use strict";

const { esc, formatTemp, formatWind, formatTime, formatHourLabel, formatDate, formatWeekday, formatDateTime, formatVisibility, compassKey, uvBand, codeInfo } = (() => {
  const f = require("../lib/format");
  const { codeInfo } = require("../weather/codes");
  return { ...f, codeInfo };
})();
const { icon } = require("./icons");
const { locationDisplayName } = require("../lib/locations");
const { skyTheme } = require("./sky");

function staleBanner(ctx, fetchedAt) {
  const { t, lang, prefs } = ctx;
  if (!fetchedAt) return "";
  const when = formatDateTime(fetchedAt, lang, prefs.timeFormat);
  return `<div class="notice notice-warn" role="status">
    <span class="badge badge-stale">${esc(t("common.stale"))}</span>
    <span>${esc(t("common.staleNotice"))} ${esc(t("common.lastUpdated"))}: ${esc(when)}</span>
  </div>`;
}

function severityBadge(t, severity) {
  const label = t(`alertsPage.severity.${severity}`);
  return `<span class="sev sev-${esc(severity)}"><span class="sev-dot" aria-hidden="true"></span>${esc(label)}</span>`;
}

function weatherLabel(t, lang, code) {
  const info = codeInfo(code);
  return esc(t(`weather.${info.labelKey}`));
}

function alertCard(ctx, alert) {
  const { t, lang, prefs } = ctx;
  const title = alert.title[lang] || alert.title.en;
  const desc = alert.description[lang] || alert.description.en;
  const actions = (alert.safetyActions || []).map((a) => `<li>${esc(a[lang] || a.en)}</li>`).join("");
  const areas = (alert.areas || []).join(", ");
  const from = alert.startsAt ? `<div class="kv"><span>${esc(t("alertsPage.validFrom"))}</span><b>${esc(formatDateTime(alert.startsAt, lang, prefs.timeFormat))}</b></div>` : "";
  const to = alert.endsAt ? `<div class="kv"><span>${esc(t("alertsPage.validTo"))}</span><b>${esc(formatDateTime(alert.endsAt, lang, prefs.timeFormat))}</b></div>` : "";
  return `<article class="alertcard sev-border-${esc(alert.severity)}">
    <div class="alerthead">${severityBadge(t, alert.severity)}<h3>${esc(title)}</h3></div>
    <p class="alertdesc">${esc(desc)}</p>
    <div class="alertmeta">
      <div class="kv"><span>${esc(t("alertsPage.affectedAreas"))}</span><b>${esc(areas)}</b></div>
      ${from}${to}
      <div class="kv"><span>${esc(t("alertsPage.source"))}</span><b>${esc(alert.source === "open-meteo-derived" ? t("alertsPage.derivedSource") : alert.source)}</b></div>
      <div class="kv"><span>${esc(t("alertsPage.updatedAt"))}</span><b>${esc(formatDateTime(alert.updatedAt, lang, prefs.timeFormat))}</b></div>
    </div>
    ${actions ? `<h4>${esc(t("alertsPage.safetyActions"))}</h4><ul class="safety">${actions}</ul>` : ""}
  </article>`;
}

/**
 * Hero current-weather section: full-width, sky-reactive panel with a huge
 * temperature readout, animated condition icon, feels-like/high/low strip
 * and a grid of stat tiles. Replaces the old plain current-weather card.
 */
function currentCard(ctx, locName, current) {
  const { t, lang, prefs } = ctx;
  const info = codeInfo(current.weatherCode);
  const iconName = (current.isDay ? info.iconDay : info.iconNight);
  const theme = skyTheme(current.weatherCode, current.isDay);
  const windUnit = prefs.windUnit;
  const windVal = formatWind(current.windKmh, windUnit);
  const windUnitLabel = t(`common.${windUnit}`);
  const compass = t(`compass.${compassKey(current.windDirectionDeg || 0)}`);
  const uv = uvBand(current.uvIndex);
  const uvLabel = uv ? t(`uv.${uv}`) : "—";
  const prob = current.precipitationProb != null ? `${Math.round(current.precipitationProb)}${t("common.percent")}` : "—";
  const tiles = [
    ["thermo", t("home.feelsLike"), formatTemp(current.feelsLikeC, prefs.tempUnit)],
    ["drop", t("home.humidity"), `${Math.round(current.humidity)}${t("common.percent")}`],
    ["wind", t("home.wind"), `${windVal} ${esc(windUnitLabel)} ${esc(compass)}`],
    ["drop", t("home.rainProb"), prob],
    ["cloudRain", t("home.rainfall"), `${current.precipitationMm} ${t("common.mm")}`],
    ["gauge", t("home.pressure"), `${Math.round(current.pressureHpa)} ${t("common.hpa")}`],
    ["eye", t("home.visibility"), formatVisibility(current.visibilityM, t)],
    ["sun", t("home.uvIndex"), uvLabel],
    ["sunrise", t("home.sunrise"), formatTime(current.sunrise, lang, prefs.timeFormat)],
    ["sunset", t("home.sunset"), formatTime(current.sunset, lang, prefs.timeFormat)],
  ];
  return `<section class="hero hero-${esc(theme)}" aria-label="${esc(t("home.currentWeather"))}">
    <div class="hero-inner">
      <div class="hero-loc">
        ${icon("pin", "wicon sm hero-pin")}
        <div><h2>${esc(locName)}</h2></div>
      </div>
      <div class="hero-main">
        <div class="hero-icon">${icon(iconName, "wicon hero-wicon")}</div>
        <div class="hero-readout">
          <div class="hero-temp">${esc(formatTemp(current.temperatureC, prefs.tempUnit))}</div>
          <div class="hero-cond">${esc(weatherLabel(t, lang, current.weatherCode))}</div>
        </div>
      </div>
      <div class="hero-strip" role="list">
        <div role="listitem"><span>${esc(t("home.feelsLike"))}</span><b>${esc(formatTemp(current.feelsLikeC, prefs.tempUnit))}</b></div>
        <div role="listitem"><span>${esc(t("home.high"))}</span><b>${esc(formatTemp(current.highC, prefs.tempUnit))}</b></div>
        <div role="listitem"><span>${esc(t("home.low"))}</span><b>${esc(formatTemp(current.lowC, prefs.tempUnit))}</b></div>
      </div>
      <dl class="hero-stats">${tiles.map(([ic, k, v]) => `
        <div class="hstat"><dt>${icon(ic, "wicon sm")}<span>${esc(k)}</span></dt><dd>${esc(v)}</dd></div>`).join("")}
      </dl>
      <p class="updated hero-updated">${esc(t("common.lastUpdated"))}: ${esc(formatDateTime(current.observedAt, lang, prefs.timeFormat))}</p>
    </div>
  </section>`;
}

/**
 * 24-hour forecast as an SVG temperature curve: smooth line, gradient fill,
 * precipitation-probability dots, time labels. Server-rendered (no JS needed).
 */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function hourlyList(ctx, hourly) {
  const { t, lang, prefs } = ctx;
  const items = hourly.slice(0, 24);
  if (!items.length) return "";
  const disp = (c) => (prefs.tempUnit === "f" ? c * 9 / 5 + 32 : c);
  const temps = items.map((h) => disp(h.temperatureC));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const W = 760, H = 216, PT = 34, PB = 40, PL = 14, PR = 14;
  const span = max - min || 1;
  const x = (i) => PL + (i * (W - PL - PR)) / (items.length - 1);
  const y = (tv) => PT + (1 - (tv - min) / span) * (H - PT - PB);
  const pts = temps.map((tv, i) => [x(i), y(tv)]);
  const line = smoothPath(pts);
  const base = H - PB + 14;
  const area = `${line}L${x(items.length - 1).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`;

  const dots = items.map((h, i) => {
    const p = h.precipitationProb;
    if (p == null || p < 20) return "";
    const r = (2 + p / 22).toFixed(1);
    return `<circle class="tcdot" cx="${x(i).toFixed(1)}" cy="${(y(temps[i]) - 12).toFixed(1)}" r="${r}"><title>${Math.round(p)}%</title></circle>`;
  }).join("");

  const labels = items.map((h, i) => {
    if (i % 3 !== 0) return "";
    return `<text class="tclabel" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(formatHourLabel(h.time, lang, prefs.timeFormat))}</text>`;
  }).join("");

  const minMax = temps.map((tv, i) => {
    if (tv !== min && tv !== max) return "";
    const above = tv === max;
    return `<text class="tctemp${above ? " hot" : " cold"}" x="${x(i).toFixed(1)}" y="${(y(tv) + (above ? -10 : 20)).toFixed(1)}" text-anchor="middle">${Math.round(tv)}°</text>
      <circle class="tcdot extreme" cx="${x(i).toFixed(1)}" cy="${y(tv).toFixed(1)}" r="4.5"/>`;
  }).join("");

  const unitLabel = prefs.tempUnit === "f" ? "°F" : "°C";
  return `<section class="card" aria-label="${esc(t("home.hourlyTitle"))}">
    <h2 class="cardtitle">${esc(t("home.hourlyTitle"))}</h2>
    <div class="tcurve-wrap">
      <svg class="tcurve" viewBox="0 0 ${W} ${H}" role="img"
        aria-label="${esc(t("home.hourlyTitle"))} — ${Math.round(min)}${unitLabel} … ${Math.round(max)}${unitLabel}">
        <defs>
          <linearGradient id="tc-line" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#fb7185"/>
          </linearGradient>
          <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stop-color="#38bdf8" stop-opacity=".38"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="tcfill" d="${area}" fill="url(#tc-fill)"/>
        ${[0.25, 0.5, 0.75].map((f) => `<line class="tcgrid" x1="${PL}" x2="${W - PR}" y1="${(PT + f * (H - PT - PB)).toFixed(1)}" y2="${(PT + f * (H - PT - PB)).toFixed(1)}"/>`).join("")}
        <path class="tcline" d="${line}" fill="none" stroke="url(#tc-line)" stroke-width="3.5" stroke-linecap="round"/>
        ${dots}${minMax}${labels}
      </svg>
    </div>
    <p class="muted small tcurve-legend">${icon("drop", "wicon xs")} ${esc(t("home.rainProb"))}</p>
  </section>`;
}

function dailyList(ctx, daily) {
  const { t, lang, prefs } = ctx;
  const windUnitLabel = t(`common.${prefs.windUnit}`);
  const items = daily.map((d, i) => {
    const info = codeInfo(d.weatherCode);
    const dayName = i === 0 ? t("common.today") : formatWeekday(`${d.date}T12:00:00`, lang);
    const prob = d.precipitationProb != null ? `${Math.round(d.precipitationProb)}${t("common.percent")}` : "—";
    return `<details class="dayitem"${i === 0 ? " open" : ""}>
      <summary>
        <span class="dname">${esc(dayName)} <span class="ddate">${esc(formatDate(`${d.date}T12:00:00`, lang))}</span></span>
        ${icon(info.iconDay, "wicon md")}
        <span class="dtemps"><b>${esc(formatTemp(d.highC, prefs.tempUnit))}</b> ${esc(formatTemp(d.lowC, prefs.tempUnit))}</span>
        <span class="dprob">${icon("drop", "wicon xs")}${esc(prob)}</span>
      </summary>
      <div class="daydetail">
        <div class="kv"><span>${esc(t("home.rainfall"))}</span><b>${esc(d.precipitationMm)} ${esc(t("common.mm"))}</b></div>
        <div class="kv"><span>${esc(t("home.wind"))}</span><b>${esc(formatWind(d.windKmh, prefs.windUnit))} ${esc(windUnitLabel)}</b></div>
        <div class="kv"><span>${esc(t("home.sunrise"))}</span><b>${esc(formatTime(d.sunrise, lang, prefs.timeFormat))}</b></div>
        <div class="kv"><span>${esc(t("home.sunset"))}</span><b>${esc(formatTime(d.sunset, lang, prefs.timeFormat))}</b></div>
      </div>
    </details>`;
  }).join("");
  return `<section class="card" aria-label="${esc(t("home.dailyTitle"))}">
    <h2 class="cardtitle">${esc(t("home.dailyTitle"))}</h2>
    <div class="daylist">${items}</div>
  </section>`;
}

function overviewGrid(ctx, overview) {
  const { t, lang, prefs } = ctx;
  const ok = overview.filter((o) => o.current);
  let hottest = null, coolest = null, rainiest = null;
  for (const o of ok) {
    if (!hottest || o.current.temperatureC > hottest.current.temperatureC) hottest = o;
    if (!coolest || o.current.temperatureC < coolest.current.temperatureC) coolest = o;
  }
  const cells = ok.map((o) => {
    const info = codeInfo(o.current.weatherCode);
    const name = locationDisplayName(o.city, lang);
    return `<a class="citycell" href="/?id=${esc(o.city.id)}">
      ${icon(o.current.isDay ? info.iconDay : info.iconNight, "wicon md")}
      <span class="cityname">${esc(name)}</span>
      <span class="citytemp">${esc(formatTemp(o.current.temperatureC, prefs.tempUnit))}</span>
    </a>`;
  }).join("");
  const stat = (label, o) => o
    ? `<div class="stat"><dt>${esc(label)}</dt><dd>${esc(locationDisplayName(o.city, lang))} · ${esc(formatTemp(o.current.temperatureC, prefs.tempUnit))}</dd></div>`
    : "";
  return `<section class="card" aria-label="${esc(t("home.overviewTitle"))}">
    <h2 class="cardtitle">${esc(t("home.overviewTitle"))}</h2>
    <dl class="stats stats-3">
      ${stat(t("home.hottest"), hottest)}
      ${stat(t("home.coolest"), coolest)}
    </dl>
    <h3 class="subtitle">${esc(t("home.cities"))}</h3>
    <div class="citygrid">${cells}</div>
  </section>`;
}

module.exports = { staleBanner, severityBadge, alertCard, currentCard, hourlyList, dailyList, overviewGrid, weatherLabel };

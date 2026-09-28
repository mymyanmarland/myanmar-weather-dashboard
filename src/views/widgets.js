// Reusable HTML fragments for weather display.
"use strict";

const { esc, formatTemp, formatWind, formatTime, formatHourLabel, formatDate, formatWeekday, formatDateTime, formatVisibility, compassKey, uvBand, codeInfo } = (() => {
  const f = require("../lib/format");
  const { codeInfo } = require("../weather/codes");
  return { ...f, codeInfo };
})();
const { icon } = require("./icons");
const { locationDisplayName } = require("../lib/locations");

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

function currentCard(ctx, locName, current) {
  const { t, lang, prefs } = ctx;
  const info = codeInfo(current.weatherCode);
  const iconName = (current.isDay ? info.iconDay : info.iconNight);
  const windUnit = prefs.windUnit;
  const windVal = formatWind(current.windKmh, windUnit);
  const windUnitLabel = t(`common.${windUnit}`);
  const compass = t(`compass.${compassKey(current.windDirectionDeg || 0)}`);
  const uv = uvBand(current.uvIndex);
  const uvLabel = uv ? t(`uv.${uv}`) : "—";
  const prob = current.precipitationProb != null ? `${Math.round(current.precipitationProb)}${t("common.percent")}` : "—";
  const rows = [
    [t("home.feelsLike"), formatTemp(current.feelsLikeC, prefs.tempUnit)],
    [t("home.high"), formatTemp(current.highC, prefs.tempUnit)],
    [t("home.low"), formatTemp(current.lowC, prefs.tempUnit)],
    [t("home.humidity"), `${Math.round(current.humidity)}${t("common.percent")}`],
    [t("home.wind"), `${windVal} ${esc(windUnitLabel)} ${esc(compass)}`],
    [t("home.rainProb"), prob],
    [t("home.rainfall"), `${current.precipitationMm} ${t("common.mm")}`],
    [t("home.pressure"), `${Math.round(current.pressureHpa)} ${t("common.hpa")}`],
    [t("home.visibility"), formatVisibility(current.visibilityM, t)],
    [t("home.uvIndex"), uvLabel],
    [t("home.sunrise"), formatTime(current.sunrise, lang, prefs.timeFormat)],
    [t("home.sunset"), formatTime(current.sunset, lang, prefs.timeFormat)],
  ];
  return `<section class="card current" aria-label="${esc(t("home.currentWeather"))}">
    <div class="current-top">
      <div>
        <h2 class="locname">${icon("pin", "wicon sm")}${esc(locName)}</h2>
        <div class="bigtemp">${esc(formatTemp(current.temperatureC, prefs.tempUnit))}</div>
        <div class="cond">${icon(iconName, "wicon lg")}<span>${weatherLabel(t, lang, current.weatherCode)}</span></div>
      </div>
      <dl class="stats">${rows.map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    </div>
    <p class="updated">${esc(t("common.lastUpdated"))}: ${esc(formatDateTime(current.observedAt, lang, prefs.timeFormat))}</p>
  </section>`;
}

function hourlyList(ctx, hourly) {
  const { t, lang, prefs } = ctx;
  const items = hourly.map((h) => {
    const info = codeInfo(h.weatherCode);
    const prob = h.precipitationProb != null ? `<span class="hprob">${icon("drop", "wicon xs")}${Math.round(h.precipitationProb)}%</span>` : "";
    return `<div class="hitem">
      <span class="htime">${esc(formatHourLabel(h.time, lang, prefs.timeFormat))}</span>
      ${icon(h.isDay ? info.iconDay : info.iconNight, "wicon md")}
      <span class="htemp">${esc(formatTemp(h.temperatureC, prefs.tempUnit))}</span>
      ${prob}
    </div>`;
  }).join("");
  return `<section class="card" aria-label="${esc(t("home.hourlyTitle"))}">
    <h2 class="cardtitle">${esc(t("home.hourlyTitle"))}</h2>
    <div class="hscroll">${items}</div>
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

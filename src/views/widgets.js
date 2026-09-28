// Reusable HTML fragments for weather display.
// Dashboard widgets: hero, hourly strip, 10-day-style rows, UV gauge,
// sunrise/sunset arc, mini map preview, sidebar rail.
"use strict";

const { esc, formatTemp, formatWind, formatTime, formatHourLabel, formatDate, formatWeekday, formatDateTime, formatVisibility, localeFor, compassKey, uvBand, codeInfo } = (() => {
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
 * Sidebar rail navigation (dashboard shell). Icon-only; labels via
 * title/aria-label. Bell carries the active-alert count badge.
 */
function dashRail(ctx, alertCount) {
  const { t, active, user } = ctx;
  const main = [
    ["home", "/", "home", null],
    ["search", "/search", "search", null],
    ["map", "/map", "map", null],
    ["bell", "/alerts", "alerts", alertCount || 0],
    ["sparkles", "/ai", "ai", null],
    ["heart", "/favorites", "favorites", null],
  ];
  const bottom = [["gear", "/settings", "settings", null]];
  if (user && user.role === "admin") bottom.push(["gauge", "/admin", "admin", null]);
  const link = ([ic, href, key, badge]) => {
    const isActive = active === key;
    const label = t(`nav.${key}`);
    const badgeHtml = badge > 0 ? `<span class="rail-badge" aria-hidden="true">${badge > 9 ? "9+" : badge}</span>` : "";
    const aria = badge > 0 ? `${label} (${badge})` : label;
    return `<a class="rail-link${isActive ? " active" : ""}" href="${esc(href)}"${isActive ? ' aria-current="page"' : ""} title="${esc(label)}" data-label="${esc(label)}" aria-label="${esc(aria)}">${icon(ic, "wicon md")}${badgeHtml}</a>`;
  };
  const brandSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="#fffbeb"/><g stroke="#fffbeb" stroke-width="2" stroke-linecap="round" opacity=".92"><path d="M12 2.8v2.5M12 18.7v2.5M2.8 12h2.5M18.7 12h2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/></g></svg>`;
  return `<nav class="rail" aria-label="${esc(t("home.railMenu"))}">
    <a class="rail-brand" href="/" aria-label="${esc(t("meta.appName"))}" title="${esc(t("meta.appName"))}">${brandSvg}</a>
    ${main.map(link).join("")}
    <span class="rail-sep" aria-hidden="true"></span>
    ${bottom.map(link).join("")}
  </nav>`;
}

/**
 * Dashboard topbar, rendered by layout() for every dash-shell page:
 * contextual heading + Yangon time/date, global search, action icons.
 * The home page sets ctx.topbarHeading to the location name; every other
 * page falls back to its <title>.
 */
function dashTopbar(ctx) {
  const { t, lang, prefs, user } = ctx;
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: "Asia/Yangon", hour: "numeric", minute: "2-digit",
    hour12: prefs.timeFormat === "12",
  }).format(now);
  const dateStr = new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: "Asia/Yangon", weekday: "short", day: "numeric", month: "short",
  }).format(now);
  const n = ctx.alertCount || 0;
  const heading = ctx.topbarHeading || ctx.title || "";
  const avatar = user
    ? `<a class="tavatar" href="/settings" title="${esc(user.name || user.email)}" aria-label="${esc(t("nav.settings"))}">${esc((user.name || user.email || "U").trim().charAt(0).toUpperCase())}</a>`
    : `<a class="tavatar tavatar-guest" href="/login" aria-label="${esc(t("nav.login"))}">${icon("user", "wicon sm")}</a>`;
  return `<header class="topbar">
    <div class="tloc">
      <strong>${esc(heading)}</strong>
      <span class="muted">${esc(timeStr)} · ${esc(dateStr)}</span>
    </div>
    <form class="tsearch" method="get" action="/search" role="search">
      ${icon("search", "wicon sm")}
      <input type="search" name="q" placeholder="${esc(t("home.searchPlaceholder"))}" aria-label="${esc(t("nav.search"))}" autocomplete="off">
    </form>
    <div class="tactions">
      <a class="ticonbtn" href="/alerts" aria-label="${esc(t("nav.alerts"))}${n ? ` (${n})` : ""}">${icon("bell", "wicon md")}${n ? `<span class="tbadge" aria-hidden="true">${n > 9 ? "9+" : n}</span>` : ""}</a>
      <a class="ticonbtn" href="/settings" aria-label="${esc(t("nav.settings"))}">${icon("gear", "wicon md")}</a>
      ${avatar}
    </div>
  </header>`;
}

/**
 * Hero current-weather panel: huge temperature, condition label, big
 * animated illustration, feels-like / humidity / wind row.
 */
function dashHero(ctx, locName, current, actionsHtml) {
  const { t, lang, prefs } = ctx;
  const info = codeInfo(current.weatherCode);
  const iconName = current.isDay ? info.iconDay : info.iconNight;
  const windVal = formatWind(current.windKmh, prefs.windUnit);
  const windUnitLabel = t(`common.${prefs.windUnit}`);
  const compass = t(`compass.${compassKey(current.windDirectionDeg || 0)}`);
  return `<section class="dhero" aria-label="${esc(t("home.currentWeather"))}">
    <div class="dhero-info">
      <p class="dhero-loc">${icon("pin", "wicon sm")}<span>${esc(locName)}</span>${actionsHtml || ""}</p>
      <div class="dhero-temp">${esc(formatTemp(current.temperatureC, prefs.tempUnit))}</div>
      <div class="dhero-cond">${esc(weatherLabel(t, lang, current.weatherCode))}</div>
      <div class="dhero-meta" role="list">
        <div role="listitem"><span>${esc(t("home.feelsLike"))}</span><b>${esc(formatTemp(current.feelsLikeC, prefs.tempUnit))}</b></div>
        <div role="listitem"><span>${esc(t("home.humidity"))}</span><b>${Math.round(current.humidity)}${esc(t("common.percent"))}</b></div>
        <div role="listitem"><span>${esc(t("home.wind"))}</span><b>${esc(windVal)} ${esc(windUnitLabel)} ${esc(compass)}</b></div>
      </div>
    </div>
    <div class="dhero-art" aria-hidden="true">${icon(iconName, "wicon dhero-wicon")}</div>
  </section>`;
}

/**
 * Hourly forecast as a horizontal scrollable strip of hour cards:
 * time, animated icon, temperature, rain chance. Server-rendered.
 */
function hourlyStrip(ctx, hourly) {
  const { t, lang, prefs } = ctx;
  const items = hourly.slice(0, 24);
  if (!items.length) return "";
  const cells = items.map((h, i) => {
    const info = codeInfo(h.weatherCode);
    const label = i === 0 ? t("common.now") : formatHourLabel(h.time, lang, prefs.timeFormat);
    const prob = h.precipitationProb != null && h.precipitationProb >= 20
      ? `<span class="hprob">${icon("drop", "wicon xs")}${Math.round(h.precipitationProb)}${esc(t("common.percent"))}</span>`
      : `<span class="hprob hprob-none" aria-hidden="true">&nbsp;</span>`;
    return `<div class="hcell" role="listitem">
      <span class="hh">${esc(label)}</span>
      ${icon(h.isDay ? info.iconDay : info.iconNight, "wicon md")}
      <b class="ht">${esc(formatTemp(h.temperatureC, prefs.tempUnit))}</b>
      ${prob}
    </div>`;
  }).join("");
  return `<section class="dcard" aria-label="${esc(t("home.hourlyTitle"))}">
    <h2 class="dcard-title">${esc(t("home.hourlyTitle"))}</h2>
    <div class="hstrip" role="list" tabindex="0">${cells}</div>
  </section>`;
}

/**
 * Daily forecast rows: day, icon, rain chance, low … range bar … high.
 * Server-rendered; the range bar is positioned against the week's span.
 */
function dailyRows(ctx, daily) {
  const { t, lang, prefs } = ctx;
  if (!daily || !daily.length) return "";
  const disp = (c) => (prefs.tempUnit === "f" ? c * 9 / 5 + 32 : c);
  const lows = daily.map((d) => disp(d.lowC));
  const highs = daily.map((d) => disp(d.highC));
  const wMin = Math.min(...lows);
  const wMax = Math.max(...highs);
  const span = wMax - wMin || 1;
  const rows = daily.map((d, i) => {
    const info = codeInfo(d.weatherCode);
    const dayName = i === 0 ? t("common.today") : formatWeekday(`${d.date}T12:00:00`, lang);
    const prob = d.precipitationProb != null && d.precipitationProb >= 20
      ? `<span class="dr-prob">${icon("drop", "wicon xs")}${Math.round(d.precipitationProb)}${esc(t("common.percent"))}</span>`
      : `<span class="dr-prob dr-prob-none" aria-hidden="true">—</span>`;
    const left = (((disp(d.lowC) - wMin) / span) * 100).toFixed(1);
    const width = ((Math.max(disp(d.highC) - disp(d.lowC), span * 0.05) / span) * 100).toFixed(1);
    return `<div class="drow">
      <span class="dr-day">${esc(dayName)}</span>
      ${icon(info.iconDay, "wicon md")}
      ${prob}
      <span class="dr-low">${esc(formatTemp(d.lowC, prefs.tempUnit))}</span>
      <span class="dr-bar" aria-hidden="true"><span class="dr-fill" style="left:${left}%;width:${width}%"></span></span>
      <b class="dr-high">${esc(formatTemp(d.highC, prefs.tempUnit))}</b>
    </div>`;
  }).join("");
  return `<section class="dcard" aria-label="${esc(t("home.dailyTitle"))}">
    <h2 class="dcard-title">${esc(t("home.dailyTitle"))}</h2>
    <div class="drows" role="list">${rows}</div>
  </section>`;
}

const UV_COLORS = { low: "#4ade80", moderate: "#facc15", high: "#fb923c", veryHigh: "#f87171", extreme: "#c084fc" };

/**
 * UV index semicircle gauge, server-rendered SVG.
 * uvIndex may be null (fallback provider) → shows "—" gracefully.
 */
function uvGauge(ctx, current) {
  const { t } = ctx;
  const uv = current.uvIndex;
  const band = uvBand(uv);
  const label = band ? t(`uv.${band}`) : "—";
  const frac = uv == null ? 0 : Math.min(Math.max(uv, 0), 11) / 11;
  const R = 50;
  const LEN = (Math.PI * R).toFixed(1);
  const filled = (frac * Math.PI * R).toFixed(1);
  const color = UV_COLORS[band] || "var(--border)";
  const dot = uv == null ? "" : (() => {
    const x = (60 - R * Math.cos(Math.PI * frac)).toFixed(1);
    const y = (62 - R * Math.sin(Math.PI * frac)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="5" class="gauge-dot" style="fill:${color}"/>`;
  })();
  return `<section class="dcard gauge-wrap" aria-label="${esc(t("home.uvIndex"))}">
    <h2 class="dcard-title">${esc(t("home.uvIndex"))}</h2>
    <svg class="gauge" viewBox="0 0 120 70" role="img" aria-label="${esc(t("home.uvIndex"))}: ${uv == null ? "—" : Math.round(uv)} — ${esc(label)}">
      <path d="M10,62 A50,50 0 0 1 110,62" class="gauge-track"/>
      <path d="M10,62 A50,50 0 0 1 110,62" class="gauge-fill" style="stroke:${color};stroke-dasharray:${filled} ${LEN}"/>
      ${dot}
    </svg>
    <div class="gauge-num">${uv == null ? "—" : Math.round(uv)}</div>
    <div class="gauge-label">${esc(label)}</div>
  </section>`;
}

/**
 * Sunrise/sunset arc widget: sun dot positioned along the arc by the
 * current time between sunrise and sunset. Server-rendered SVG.
 */
function sunArc(ctx, current) {
  const { t, lang, prefs } = ctx;
  const sr = new Date(current.sunrise).getTime();
  const ss = new Date(current.sunset).getTime();
  let frac = 0.5;
  if (Number.isFinite(sr) && Number.isFinite(ss) && ss > sr) {
    frac = (Date.now() - sr) / (ss - sr);
    frac = Math.min(Math.max(frac, 0), 1);
  }
  const cx = 100, cy = 92, R = 78;
  const x = (cx - R * Math.cos(Math.PI * frac)).toFixed(1);
  const y = (cy - R * Math.sin(Math.PI * frac)).toFixed(1);
  const srT = formatTime(current.sunrise, lang, prefs.timeFormat);
  const ssT = formatTime(current.sunset, lang, prefs.timeFormat);
  return `<section class="dcard sunarc-wrap" aria-label="${esc(t("home.sunWidgetTitle"))}">
    <h2 class="dcard-title">${esc(t("home.sunWidgetTitle"))}</h2>
    <svg class="sunarc" viewBox="0 0 200 104" role="img" aria-label="${esc(t("home.sunrise"))} ${esc(srT)}, ${esc(t("home.sunset"))} ${esc(ssT)}">
      <line x1="8" y1="92" x2="192" y2="92" class="sunarc-horizon"/>
      <path d="M22,92 A78,78 0 0 1 178,92" class="sunarc-track"/>
      <circle cx="${x}" cy="${y}" r="13" class="sunarc-glow"/>
      <circle cx="${x}" cy="${y}" r="8" class="sunarc-sun"/>
    </svg>
    <div class="sunarc-labels">
      <span>${icon("sunrise", "wicon xs")} ${esc(srT)}</span>
      <span>${esc(ssT)} ${icon("sunset", "wicon xs")}</span>
    </div>
  </section>`;
}

// --- Mini map (static OSM tile mosaic, zero JS) ---------------------------
function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
}

/**
 * Lightweight map preview: a 2x2 OpenStreetMap tile mosaic framed on
 * Myanmar with a pin at the current location, linking to the full /map
 * page. No JavaScript; images are lazy-loaded.
 */
function miniMap(ctx, loc) {
  const { t, lang } = ctx;
  const z = 5;
  const x0 = 23, y0 = 13; // fixed Myanmar framing
  const tiles = [];
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = x0 + dx, y = y0 + dy;
      tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${x}/${y}.png" alt="" loading="lazy" draggable="false">`);
    }
  }
  const px = Math.min(Math.max((lonToTileX(loc.lon, z) - x0) * 256, 10), 502);
  const py = Math.min(Math.max((latToTileY(loc.lat, z) - y0) * 256, 10), 502);
  const label = locationDisplayName(loc, lang);
  return `<section class="dcard dmap-card" aria-label="${esc(t("home.miniMapTitle"))}">
    <h2 class="dcard-title">${esc(t("home.miniMapTitle"))}</h2>
    <a class="minimap" href="/map" aria-label="${esc(t("home.openFullMap"))} — ${esc(label)}">
      <span class="minimap-tiles" aria-hidden="true">${tiles.join("")}</span>
      <span class="mmap-pin" aria-hidden="true" style="left:${(px / 512 * 100).toFixed(2)}%;top:${(py / 512 * 100).toFixed(2)}%"></span>
      <span class="mmap-chip">${icon("map", "wicon xs")} ${esc(t("home.openFullMap"))}</span>
    </a>
  </section>`;
}

/**
 * 12-city Myanmar overview, restyled as a compact dashboard grid with
 * hottest/coolest highlight chips.
 */
function overviewGrid(ctx, overview) {
  const { t, lang, prefs } = ctx;
  const ok = overview.filter((o) => o.current);
  let hottest = null, coolest = null;
  for (const o of ok) {
    if (!hottest || o.current.temperatureC > hottest.current.temperatureC) hottest = o;
    if (!coolest || o.current.temperatureC < coolest.current.temperatureC) coolest = o;
  }
  const cells = ok.map((o) => {
    const info = codeInfo(o.current.weatherCode);
    const name = locationDisplayName(o.city, lang);
    return `<a class="dcity" href="/?id=${esc(o.city.id)}">
      ${icon(o.current.isDay ? info.iconDay : info.iconNight, "wicon md")}
      <span class="dcity-name">${esc(name)}</span>
      <b class="dcity-temp">${esc(formatTemp(o.current.temperatureC, prefs.tempUnit))}</b>
    </a>`;
  }).join("");
  const chip = (label, o) => o
    ? `<span class="dchip">${esc(label)}: <b>${esc(locationDisplayName(o.city, lang))} ${esc(formatTemp(o.current.temperatureC, prefs.tempUnit))}</b></span>`
    : "";
  return `<section class="dcard" aria-label="${esc(t("home.overviewTitle"))}">
    <h2 class="dcard-title">${esc(t("home.overviewTitle"))}</h2>
    <div class="dchips">${chip(t("home.hottest"), hottest)}${chip(t("home.coolest"), coolest)}</div>
    <div class="dcitygrid">${cells}</div>
  </section>`;
}

module.exports = {
  staleBanner, severityBadge, alertCard, weatherLabel,
  dashRail, dashTopbar, dashHero, hourlyStrip, dailyRows, uvGauge, sunArc, miniMap,
  overviewGrid,
};

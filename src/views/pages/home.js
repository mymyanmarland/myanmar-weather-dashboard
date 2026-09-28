// Home dashboard: reference-style layout — topbar (location/time, search,
// actions), hero current-weather, widget column (mini map, UV gauge,
// sunrise/sunset), hourly strip, 7-day rows, alerts, 12-city overview.
"use strict";

const { esc, formatDateTime, localeFor } = require("../../lib/format");
const { locationDisplayName, locationHierarchy } = require("../../lib/locations");
const { staleBanner, alertCard, dashHero, hourlyStrip, dailyRows, uvGauge, sunArc, miniMap, overviewGrid } = require("../widgets");
const { icon } = require("../icons");
const { skyTheme, skyFx } = require("../sky");

/**
 * data: {
 *   loc: { lat, lon, nameEn, nameMy, stateEn, stateMy, id? },
 *   current: { data, fetchedAt, stale } | null,
 *   hourly, daily, alerts: same,
 *   overview: [...],
 *   announcements: [...],
 *   isDefaultLoc: bool, user
 * }
 */

function topbar(ctx, locName) {
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
  const avatar = user
    ? `<a class="tavatar" href="/settings" title="${esc(user.name || user.email)}" aria-label="${esc(t("nav.settings"))}">${esc((user.name || user.email || "U").trim().charAt(0).toUpperCase())}</a>`
    : `<a class="tavatar tavatar-guest" href="/login" aria-label="${esc(t("nav.login"))}">${icon("user", "wicon sm")}</a>`;
  return `<header class="topbar">
    <div class="tloc">
      <strong>${esc(locName)}</strong>
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

function favoriteButton(ctx, data) {
  const { t, user } = ctx;
  if (!user || !data.loc) return "";
  if (data.isFavorite) {
    return `<span class="favsaved" title="${esc(t("home.savedFavorite"))}">${icon("heart", "wicon sm")}</span>`;
  }
  return `<form class="inlineform" method="post" action="/api/favorites">
    <input type="hidden" name="nameEn" value="${esc(data.loc.nameEn)}">
    <input type="hidden" name="nameMy" value="${esc(data.loc.nameMy || "")}">
    <input type="hidden" name="stateEn" value="${esc(data.loc.stateEn || "")}">
    <input type="hidden" name="stateMy" value="${esc(data.loc.stateMy || "")}">
    <input type="hidden" name="lat" value="${esc(data.loc.lat)}">
    <input type="hidden" name="lon" value="${esc(data.loc.lon)}">
    <input type="hidden" name="redirect" value="${esc(ctx.path)}">
    <button class="iconbtn" type="submit" title="${esc(t("home.saveFavorite"))}" aria-label="${esc(t("home.saveFavorite"))}">${icon("heart", "wicon sm")}</button>
  </form>`;
}

function homePage(ctx, data) {
  const { t, lang, prefs } = ctx;
  // Dashboard shell mode: layout() renders the icon rail instead of the
  // standard header for this page.
  ctx.dash = true;

  const locName = locationDisplayName(data.loc, lang);
  const hier = data.loc.stateEn || data.loc.stateMy ? locationHierarchy(data.loc, lang) : locName;

  const alerts = data.alerts && data.alerts.data ? data.alerts.data : [];
  ctx.alertCount = alerts.length;

  let staleHtml = "";
  const anyStale = [data.current, data.hourly, data.daily].some((r) => r && r.stale);
  const fetchedAt = (data.current && data.current.fetchedAt) || null;
  if (anyStale) staleHtml = staleBanner(ctx, fetchedAt);

  const announceHtml = (data.announcements || []).length
    ? `<section class="dcard announce">${data.announcements.map((a) => `<article><h3>${esc(a["title_" + lang] || a.title_en)}</h3><p>${esc(a["body_" + lang] || a.body_en)}</p></article>`).join("")}</section>`
    : "";

  const cur = data.current && data.current.data ? data.current.data : null;
  if (cur) {
    ctx.bodyClass = `sky-${skyTheme(cur.weatherCode, cur.isDay)}`;
  } else {
    ctx.bodyClass = "sky-cloudy-day";
  }

  const heroActions = favoriteButton(ctx, data)
    + (data.isDefaultLoc ? `<span class="muted small">· ${esc(t("home.defaultLocationHint"))}</span>` : "");

  const heroHtml = cur
    ? dashHero(ctx, hier, cur, heroActions)
    : `<section class="dcard"><p class="error">${esc(t("common.error"))}</p></section>`;

  const widgetsHtml = cur
    ? `<div class="dwidgets">
        ${miniMap(ctx, data.loc)}
        <div class="dwidgets-row">
          ${uvGauge(ctx, cur)}
          ${sunArc(ctx, cur)}
        </div>
      </div>`
    : "";

  const alertsHtml = alerts.length
    ? `<section class="dcard" aria-label="${esc(t("home.activeAlerts"))}">
        <h2 class="dcard-title">${esc(t("home.activeAlerts"))} (${alerts.length})</h2>
        <div class="alertlist">${alerts.map((a) => alertCard(ctx, a)).join("")}</div>
        <p><a class="btn btn-ghost btn-sm" href="/alerts">${esc(t("home.viewAllAlerts"))}</a></p>
      </section>`
    : `<section class="dcard"><h2 class="dcard-title">${esc(t("home.activeAlerts"))}</h2><p class="muted">${esc(t("home.noActiveAlerts"))}</p></section>`;

  const hourlyHtml = data.hourly && data.hourly.data
    ? `<div class="dspan">${hourlyStrip(ctx, data.hourly.data)}</div>` : "";
  const dailyHtml = data.daily && data.daily.data
    ? `<div class="dspan">${dailyRows(ctx, data.daily.data)}</div>` : "";
  const overviewHtml = data.overview ? overviewGrid(ctx, data.overview) : "";

  const updatedHtml = fetchedAt && !anyStale
    ? `<p class="updated"><span class="livedot" aria-hidden="true"></span>${esc(t("home.live"))} · ${esc(t("common.lastUpdated"))}: ${esc(formatDateTime(fetchedAt, lang, prefs.timeFormat))}</p>`
    : "";

  return `
    ${skyFx()}
    ${topbar(ctx, locName)}
    ${staleHtml}
    <div class="dash-grid">
      <div class="dhero-wrap">${heroHtml}</div>
      ${widgetsHtml}
      ${hourlyHtml}
      ${dailyHtml}
    </div>
    ${alertsHtml}
    ${announceHtml}
    ${overviewHtml}
    ${updatedHtml}`;
}

module.exports = { homePage };

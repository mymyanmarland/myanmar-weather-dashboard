// Home dashboard: current + 24h hourly + 7-day daily + 12-city overview + alerts.
"use strict";

const { esc, formatDateTime } = require("../../lib/format");
const { locationDisplayName, locationHierarchy } = require("../../lib/locations");
const { staleBanner, alertCard, currentCard, hourlyList, dailyList, overviewGrid } = require("../widgets");
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
function homePage(ctx, data) {
  const { t, lang, prefs, user } = ctx;
  const locName = locationDisplayName(data.loc, lang);
  const hier = data.loc.stateEn || data.loc.stateMy ? locationHierarchy(data.loc, lang) : locName;

  let staleHtml = "";
  const anyStale = [data.current, data.hourly, data.daily].some((r) => r && r.stale);
  const fetchedAt = (data.current && data.current.fetchedAt) || null;
  if (anyStale) staleHtml = staleBanner(ctx, fetchedAt);
  else if (fetchedAt) {
    staleHtml = `<p class="updated"><span class="livedot" aria-hidden="true"></span>${esc(t("home.live"))} · ${esc(t("common.lastUpdated"))}: ${esc(formatDateTime(fetchedAt, lang, prefs.timeFormat))}</p>`;
  }

  const alerts = data.alerts && data.alerts.data ? data.alerts.data : [];
  const alertsHtml = alerts.length
    ? `<section class="card" aria-label="${esc(t("home.activeAlerts"))}">
        <h2 class="cardtitle">${esc(t("home.activeAlerts"))} (${alerts.length})</h2>
        <div class="alertlist">${alerts.map((a) => alertCard(ctx, a)).join("")}</div>
        <p><a class="btn btn-ghost btn-sm" href="/alerts">${esc(t("home.viewAllAlerts"))}</a></p>
      </section>`
    : `<section class="card"><h2 class="cardtitle">${esc(t("home.activeAlerts"))}</h2><p class="muted">${esc(t("home.noActiveAlerts"))}</p></section>`;

  const announceHtml = (data.announcements || []).length
    ? `<section class="card announce">${data.announcements.map((a) => `<article><h3>${esc(a["title_" + lang] || a.title_en)}</h3><p>${esc(a["body_" + lang] || a.body_en)}</p></article>`).join("")}</section>`
    : "";

  const favForm = user && data.loc
    ? (data.isFavorite
      ? `<span class="favsaved">${esc(t("home.savedFavorite"))}</span>`
      : `<form class="inlineform" method="post" action="/api/favorites">
          <input type="hidden" name="nameEn" value="${esc(data.loc.nameEn)}">
          <input type="hidden" name="nameMy" value="${esc(data.loc.nameMy || "")}">
          <input type="hidden" name="stateEn" value="${esc(data.loc.stateEn || "")}">
          <input type="hidden" name="stateMy" value="${esc(data.loc.stateMy || "")}">
          <input type="hidden" name="lat" value="${esc(data.loc.lat)}">
          <input type="hidden" name="lon" value="${esc(data.loc.lon)}">
          <input type="hidden" name="redirect" value="${esc(ctx.path)}">
          <button class="btn btn-ghost btn-sm" type="submit">${icon("heart", "wicon sm")} ${esc(t("home.saveFavorite"))}</button>
        </form>`)
    : "";

  const currentHtml = data.current && data.current.data
    ? currentCard(ctx, hier, data.current.data)
    : `<section class="card"><p class="error">${esc(t("common.error"))}</p></section>`;

  // Weather-reactive page background: body class + animated sky layer.
  // Falls back to a neutral cloudy-day sky when live data is unavailable,
  // so the page still has atmosphere in its graceful-degraded state.
  if (data.current && data.current.data) {
    ctx.bodyClass = `sky-${skyTheme(data.current.data.weatherCode, data.current.data.isDay)}`;
  } else {
    ctx.bodyClass = "sky-cloudy-day";
  }

  const hourlyHtml = data.hourly && data.hourly.data ? hourlyList(ctx, data.hourly.data) : "";
  const dailyHtml = data.daily && data.daily.data ? dailyList(ctx, data.daily.data) : "";
  const overviewHtml = data.overview ? overviewGrid(ctx, data.overview) : "";

  return `
    ${skyFx()}
    <div class="pagehead">
      <div>
        <h1>${esc(t("home.title"))}</h1>
        <p class="muted">${esc(t("home.subtitle"))}</p>
        ${data.isDefaultLoc ? `<p class="muted small">${esc(t("home.defaultLocationHint"))}</p>` : ""}
      </div>
      <div class="pageactions">${favForm}</div>
    </div>
    ${staleHtml}
    ${announceHtml}
    ${currentHtml}
    ${alertsHtml}
    ${hourlyHtml}
    ${dailyHtml}
    ${overviewHtml}`;
}

module.exports = { homePage };

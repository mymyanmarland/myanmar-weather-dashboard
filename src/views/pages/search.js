// Search page: server-rendered results + client autocomplete + recents + geolocation.
"use strict";

const { esc } = require("../../lib/format");
const { icon } = require("../icons");

function resultLink(ctx, r) {
  // r: { lat, lon, nameEn, nameMy, hier }
  const { t, lang } = ctx;
  const name = lang === "my" ? (r.nameMy || r.nameEn) : r.nameEn;
  const href = `/?lat=${encodeURIComponent(r.lat)}&lon=${encodeURIComponent(r.lon)}&name=${encodeURIComponent(r.nameEn)}`;
  return `<a class="resultitem" href="${href}">
    ${icon("pin", "wicon md")}
    <span><b>${esc(name)}</b><small>${esc(r.hier || "")}</small></span>
  </a>`;
}

function searchPage(ctx, data) {
  const { t, lang } = ctx;
  const q = data.q || "";
  let resultsHtml = "";
  if (data.searched) {
    const all = [...(data.localResults || []), ...(data.geoResults || [])];
    resultsHtml = all.length
      ? `<h2 class="subtitle">${esc(t("search.resultsFor"))} “${esc(q)}”</h2>
         <div class="resultlist">${all.map((r) => resultLink(ctx, r)).join("")}</div>`
      : `<p class="notice">${esc(t("search.noResults"))}</p>`;
  }
  return `
  <div class="pagehead"><div>
    <h1>${esc(t("search.title"))}</h1>
    <p class="muted">${esc(t("search.subtitle"))}</p>
  </div></div>
  <section class="card">
    <form method="get" action="/search" class="searchform" role="search">
      <input id="search-input" type="search" name="q" value="${esc(q)}"
        placeholder="${esc(t("search.placeholder"))}" autocomplete="off" aria-label="${esc(t("search.title"))}">
      <button class="btn btn-primary" type="submit">${icon("search", "wicon sm")}<span class="sm-hide">${esc(t("nav.search"))}</span></button>
    </form>
    <div id="search-suggest" class="suggest" hidden></div>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("search.recentTitle"))}</h2>
    <div id="recent-list" class="resultlist"><p class="muted" id="recent-empty">—</p></div>
    <button id="recent-clear" class="btn btn-ghost btn-sm" type="button" hidden>${esc(t("search.clearRecent"))}</button>
  </section>
  <section class="card">
    <button id="geo-btn" class="btn btn-ghost" type="button"
      data-locating="${esc(t("search.locating"))}"
      data-denied="${esc(t("search.geoDenied"))}"
      data-unavailable="${esc(t("search.geoUnavailable"))}"
      data-timeout="${esc(t("search.geoTimeout"))}"
      data-unsupported="${esc(t("search.geoUnsupported"))}">${icon("pin", "wicon sm")} ${esc(t("search.useMyLocation"))}</button>
    <p id="geo-status" class="muted small" role="status"></p>
  </section>
  ${resultsHtml}`;
}

module.exports = { searchPage };

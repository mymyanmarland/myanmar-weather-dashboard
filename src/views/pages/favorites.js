// Favorites page (registered users only): compare + manage (default, reorder, remove).
"use strict";

const { esc, formatTemp } = require("../../lib/format");
const { icon } = require("../icons");
const { codeInfo } = require("../../weather/codes");

function favoritesPage(ctx, data) {
  const { t, lang, prefs } = ctx;
  if (!ctx.user) {
    return `
    <p class="muted pagelead">${esc(t("favorites.subtitle"))}</p>
    <section class="card center">
      <h2>${esc(t("favorites.signInRequired"))}</h2>
      <p class="muted">${esc(t("favorites.signInRequiredDesc"))}</p>
      <p><a class="btn btn-primary" href="/login">${esc(t("nav.login"))}</a>
      <a class="btn btn-ghost" href="/signup">${esc(t("nav.signup"))}</a></p>
    </section>`;
  }

  const favs = data.favorites || [];
  const compare = favs.length
    ? `<section class="card">
        <h2 class="cardtitle">${esc(t("favorites.compareTitle"))}</h2>
        <div class="citygrid">${favs.map((f) => {
          const info = f.current ? codeInfo(f.current.weatherCode) : null;
          const temp = f.current ? formatTemp(f.current.temperatureC, prefs.tempUnit) : "—";
          const name = lang === "my" && f.name_my ? f.name_my : f.name_en;
          return `<a class="citycell" href="/?lat=${esc(f.lat)}&lon=${esc(f.lon)}&name=${encodeURIComponent(f.name_en)}">
            ${info ? icon(f.current.isDay ? info.iconDay : info.iconNight, "wicon md") : ""}
            <span class="cityname">${esc(name)}${f.is_default ? ` <span class="badge">${esc(t("favorites.isDefault"))}</span>` : ""}</span>
            <span class="citytemp">${esc(temp)}</span>
          </a>`;
        }).join("")}</div>
      </section>`
    : "";

  const list = favs.length
    ? `<ul class="favlist">${favs.map((f, i) => {
        const name = lang === "my" && f.name_my ? f.name_my : f.name_en;
        return `<li class="favrow">
          <span class="favname"><b>${esc(name)}</b><small>${esc(f.lat.toFixed(2))}, ${esc(f.lon.toFixed(2))}</small>${f.is_default ? ` <span class="badge">${esc(t("favorites.isDefault"))}</span>` : ""}</span>
          <span class="favactions">
            ${!f.is_default ? `<form class="inlineform" method="post" action="/api/favorites/${f.id}/default"><button class="btn btn-ghost btn-sm" type="submit">${esc(t("favorites.setDefault"))}</button></form>` : ""}
            <form class="inlineform" method="post" action="/api/favorites/${f.id}/move"><input type="hidden" name="dir" value="up"><button class="btn btn-ghost btn-sm" type="submit" ${i === 0 ? "disabled" : ""} aria-label="${esc(t("common.moveUp"))}">↑</button></form>
            <form class="inlineform" method="post" action="/api/favorites/${f.id}/move"><input type="hidden" name="dir" value="down"><button class="btn btn-ghost btn-sm" type="submit" ${i === favs.length - 1 ? "disabled" : ""} aria-label="${esc(t("common.moveDown"))}">↓</button></form>
            <form class="inlineform" method="post" action="/api/favorites/${f.id}/delete"><button class="btn btn-ghost btn-sm danger" type="submit">${esc(t("favorites.removeFavorite"))}</button></form>
          </span>
        </li>`;
      }).join("")}</ul>`
    : `<p class="notice">${esc(t("favorites.noFavorites"))}</p>`;

  return `
  <p class="muted pagelead">${esc(t("favorites.subtitle"))}</p>
  ${compare}
  <section class="card"><h2 class="cardtitle">${esc(t("favorites.title"))}</h2>${list}</section>`;
}

module.exports = { favoritesPage };

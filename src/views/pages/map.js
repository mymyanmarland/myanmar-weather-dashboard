// Map page: server renders the fallback shell; Leaflet loads only on user click.
"use strict";

const { esc } = require("../../lib/format");
const { MYANMAR_LOCATIONS } = require("../../lib/locations");

function mapPage(ctx) {
  const { t } = ctx;
  // City coords embedded for the client loader (no extra request needed).
  const cities = MYANMAR_LOCATIONS.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon }));
  return `
  <div class="pagehead"><div>
    <h1>${esc(t("mapPage.title"))}</h1>
    <p class="muted">${esc(t("mapPage.subtitle"))}</p>
  </div></div>
  <section class="card mapcard">
    <div id="map-fallback" class="mapfallback">
      <p>${esc(t("mapPage.subtitle"))}</p>
      <button id="map-load-btn" class="btn btn-primary" type="button"
        data-loading="${esc(t("mapPage.loadingMap"))}"
        data-failed="${esc(t("mapPage.mapFailed"))}">${esc(t("mapPage.loadMap"))}</button>
      <p id="map-status" class="muted small" role="status"></p>
    </div>
    <div id="map" class="leaflet-map" hidden></div>
    <div id="map-layers" class="maplayers" hidden>
      <span>${esc(t("mapPage.layers"))}:</span>
      ${["temp", "rain", "wind", "alerts"].map((l, i) => `
        <button type="button" class="layerbtn${i === 0 ? " active" : ""}" data-layer="${l}" aria-pressed="${i === 0}">${esc(t(`mapPage.layer${l[0].toUpperCase()}${l.slice(1)}`))}</button>`).join("")}
    </div>
  </section>
  <script id="map-cities" type="application/json">${esc(JSON.stringify(cities))}</script>`;
}

module.exports = { mapPage };

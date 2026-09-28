// Lazy Leaflet map loader. Leaflet (CSS+JS) is injected only when the user
// clicks "load map". Falls back to a friendly message on any failure.
(function () {
  "use strict";
  var btn = document.getElementById("map-load-btn");
  var statusEl = document.getElementById("map-status");
  var fallback = document.getElementById("map-fallback");
  var mapEl = document.getElementById("map");
  var layersEl = document.getElementById("map-layers");
  if (!btn || !mapEl) return;

  var LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  var LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function loadCss(href) {
    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  function loadJs(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function readCities() {
    try {
      var el = document.getElementById("map-cities");
      return el ? JSON.parse(el.textContent) : [];
    } catch (e) {
      return [];
    }
  }

  var layerCircles = [];
  var map = null;
  var alertMarkers = [];

  function colorForTemp(t) {
    if (t >= 38) return "#b91c1c";
    if (t >= 33) return "#ea580c";
    if (t >= 28) return "#ca8a04";
    if (t >= 22) return "#15803d";
    return "#0284c7";
  }

  function drawLayer(L, layer, overview) {
    layerCircles.forEach(function (c) { map.removeLayer(c); });
    layerCircles = [];
    alertMarkers.forEach(function (m) { map.removeLayer(m); });
    alertMarkers = [];

    if (layer === "alerts") {
      overview.cities.forEach(function (c) {
        if (!c.current || !c.current.alertCount) return;
        var m = L.marker([c.lat, c.lon]).addTo(map);
        m.bindPopup("<b>" + escapeHtml(c.nameMy || c.nameEn) + "</b><br>" + c.current.alertCount + " alert(s)");
        alertMarkers.push(m);
      });
      return;
    }
    overview.cities.forEach(function (c) {
      if (!c.current) return;
      var value, color, label;
      if (layer === "temp") {
        value = c.current.temperatureC;
        color = colorForTemp(value);
        label = Math.round(value) + "°C";
      } else if (layer === "rain") {
        value = c.current.precipitationProb != null ? c.current.precipitationProb : 0;
        color = value >= 60 ? "#1d4ed8" : value >= 30 ? "#3b82f6" : "#93c5fd";
        label = Math.round(value) + "%";
      } else {
        value = c.current.windKmh || 0;
        color = value >= 40 ? "#7c3aed" : value >= 20 ? "#a78bfa" : "#c4b5fd";
        label = Math.round(value) + " km/h";
      }
      var circle = L.circle([c.lat, c.lon], {
        radius: 45000,
        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2,
      }).addTo(map);
      circle.bindTooltip("<b>" + escapeHtml(c.nameMy || c.nameEn) + "</b><br>" + label, { sticky: true });
      layerCircles.push(circle);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  btn.addEventListener("click", function () {
    btn.disabled = true;
    var loadingMsg = btn.getAttribute("data-loading") || "Loading map…";
    setStatus(loadingMsg);

    var cities = readCities();
    loadCss(LEAFLET_CSS)
      .then(function () { return loadJs(LEAFLET_JS); })
      .then(function () { return fetch("/api/overview").then(function (r) { return r.json(); }); })
      .then(function (overview) {
        if (fallback) fallback.hidden = true;
        mapEl.hidden = false;
        if (layersEl) layersEl.hidden = false;
        map = L.map("map").setView([19.7, 96.2], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        overview.cities.forEach(function (c) {
          if (!c.current) return;
          var marker = L.marker([c.lat, c.lon]).addTo(map);
          var label = c.nameMy || c.nameEn;
          marker.bindPopup("<b>" + escapeHtml(label) + "</b><br>" +
            Math.round(c.current.temperatureC) + "°C" +
            (c.stale ? " (stale)" : ""));
        });

        drawLayer(L, "temp", overview);
        if (layersEl) {
          layersEl.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest(".layerbtn");
            if (!b) return;
            layersEl.querySelectorAll(".layerbtn").forEach(function (x) {
              x.classList.remove("active");
              x.setAttribute("aria-pressed", "false");
            });
            b.classList.add("active");
            b.setAttribute("aria-pressed", "true");
            drawLayer(L, b.getAttribute("data-layer"), overview);
          });
        }
        setStatus("");
      })
      .catch(function () {
        btn.disabled = false;
        var failMsg = btn.getAttribute("data-failed") || "The map could not be loaded.";
        setStatus(failMsg);
      });
  });
})();

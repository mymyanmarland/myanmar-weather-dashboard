// Approximate geolocation button (search page). Redirects to the dashboard
// with coordinates; shows localized states for denied/unavailable/timeout.
(function () {
  "use strict";
  var btn = document.getElementById("geo-btn");
  var status = document.getElementById("geo-status");
  if (!btn) return;

  var STR = {
    locating: btn.getAttribute("data-locating") || "Locating…",
    denied: btn.getAttribute("data-denied") || "Location permission was denied. Please search manually.",
    unavailable: btn.getAttribute("data-unavailable") || "Your device could not determine its location.",
    timeout: btn.getAttribute("data-timeout") || "Location request timed out. Please search manually.",
    unsupported: btn.getAttribute("data-unsupported") || "Geolocation is not supported by this browser.",
  };

  btn.addEventListener("click", function () {
    if (!("geolocation" in navigator)) {
      if (status) status.textContent = STR.unsupported;
      return;
    }
    btn.disabled = true;
    if (status) status.textContent = STR.locating;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude.toFixed(4);
        var lon = pos.coords.longitude.toFixed(4);
        window.location.href = "/?lat=" + encodeURIComponent(lat) +
          "&lon=" + encodeURIComponent(lon);
      },
      function (err) {
        btn.disabled = false;
        if (!status) return;
        if (err.code === 1) status.textContent = STR.denied;
        else if (err.code === 2) status.textContent = STR.unavailable;
        else if (err.code === 3) status.textContent = STR.timeout;
        else status.textContent = STR.unavailable;
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  });
})();

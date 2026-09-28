// Recent locations for guests (localStorage). Exposes window.MWRecents.
(function () {
  "use strict";
  var KEY = "mw:recent";
  var MAX = 8;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (e) { /* ignore */ }
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function saveFromLink(href) {
    try {
      var u = new URL(href, window.location.origin);
      var lat = u.searchParams.get("lat");
      var lon = u.searchParams.get("lon");
      var name = u.searchParams.get("name");
      if (!lat || !lon) return;
      var list = read().filter(function (r) {
        return !(r.lat === lat && r.lon === lon);
      });
      list.unshift({ lat: lat, lon: lon, name: name || (lat + ", " + lon), at: Date.now() });
      write(list);
    } catch (e) { /* ignore */ }
  }

  window.MWRecents = { saveFromLink: saveFromLink, read: read };

  // Render the recent list on the search page.
  document.addEventListener("DOMContentLoaded", function () {
    var listEl = document.getElementById("recent-list");
    var clearBtn = document.getElementById("recent-clear");
    if (!listEl) return;
    var emptyEl = document.getElementById("recent-empty");

    function render() {
      var list = read();
      if (!list.length) {
        listEl.innerHTML = '<p class="muted" id="recent-empty">—</p>';
        if (clearBtn) clearBtn.hidden = true;
        return;
      }
      listEl.innerHTML = list.map(function (r) {
        var href = "/?lat=" + encodeURIComponent(r.lat) + "&lon=" + encodeURIComponent(r.lon) +
          "&name=" + encodeURIComponent(r.name);
        return '<a class="resultitem" href="' + esc(href) + '"><span><b>' + esc(r.name) +
          '</b><small>' + esc(r.lat) + ", " + esc(r.lon) + "</small></span></a>";
      }).join("");
      if (clearBtn) clearBtn.hidden = false;
    }

    // Save server-rendered result clicks too.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".resultitem");
      if (a && a.href) saveFromLink(a.href);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        write([]);
        render();
      });
    }
    render();
  });
})();

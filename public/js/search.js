// Search autocomplete (progressive enhancement — the form works without JS).
(function () {
  "use strict";
  var input = document.getElementById("search-input");
  var box = document.getElementById("search-suggest");
  if (!input || !box) return;

  var timer = null;
  var activeIdx = -1;
  var items = [];

  function hide() {
    box.hidden = true;
    box.innerHTML = "";
    items = [];
    activeIdx = -1;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(results) {
    items = results;
    activeIdx = -1;
    if (!results.length) {
      hide();
      return;
    }
    box.innerHTML = results.map(function (r, i) {
      return '<a href="/?lat=' + encodeURIComponent(r.latitude) +
        "&lon=" + encodeURIComponent(r.longitude) +
        "&name=" + encodeURIComponent(r.nameEn || r.name) +
        '" data-idx="' + i + '"><span><b>' + esc(r.name) + "</b>" +
        (r.hier ? "<small>" + esc(r.hier) + "</small>" : "") + "</span></a>";
    }).join("");
    box.hidden = false;
  }

  input.addEventListener("input", function () {
    var q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) {
      hide();
      return;
    }
    timer = setTimeout(function () {
      fetch("/api/geocode?q=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (j) { render(j.results || []); })
        .catch(function () { hide(); });
    }, 250);
  });

  input.addEventListener("keydown", function (e) {
    if (box.hidden || !items.length) return;
    var links = box.querySelectorAll("a");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = e.key === "ArrowDown"
        ? (activeIdx + 1) % links.length
        : (activeIdx - 1 + links.length) % links.length;
      links.forEach(function (a, i) { a.classList.toggle("active", i === activeIdx); });
      if (links[activeIdx]) links[activeIdx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && activeIdx >= 0 && links[activeIdx]) {
      e.preventDefault();
      window.location.href = links[activeIdx].href;
    } else if (e.key === "Escape") {
      hide();
    }
  });

  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && e.target !== input) hide();
  });

  // Save chosen location to recents (read by recent.js).
  box.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (a && window.MWRecents) window.MWRecents.saveFromLink(a.href);
  });
})();

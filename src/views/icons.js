// Hand-drawn inline SVG weather icons (no icon library, no emoji dependency).
// Animated parts are wrapped in groups with wx-* classes; keyframes live in
// public/css/style.css. All animation is disabled under
// prefers-reduced-motion, leaving clean static icons.
"use strict";

function icon(name, cls) {
  const c = cls || "wicon";
  const inner = {
    sun:
      '<g class="wx-spin"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></g><circle cx="12" cy="12" r="4.2"/>',
    moon:
      '<g class="wx-pulse"><path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z"/></g>',
    cloudSun:
      '<g class="wx-spin"><circle cx="7.5" cy="7.5" r="2.6"/><path d="M7.5 2v1.4M2 7.5h1.4M3.6 3.6l1 1M11.4 3.6l-1 1"/></g><g class="wx-drift"><path d="M8 20h9.5a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 8.4 14.6 3 3 0 0 0 8 20z"/></g>',
    cloudMoon:
      '<g class="wx-pulse"><path d="M18.5 3.5a5 5 0 1 0 3 9"/></g><g class="wx-drift"><path d="M7 21h9.5a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 7.4 15.6 3 3 0 0 0 7 21z"/></g>',
    cloud:
      '<g class="wx-drift"><path d="M7 20h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 13.4 3.5 3.5 0 0 0 7 20z"/></g>',
    cloudFog:
      '<g class="wx-drift"><path d="M7 16h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 9.4 3.5 3.5 0 0 0 7 16z"/></g><g class="wx-foglines"><path d="M4 19h16M6 22h12"/></g>',
    cloudDrizzle:
      '<g class="wx-drift"><path d="M7 15h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 8.4 3.5 3.5 0 0 0 7 15z"/></g><g class="wx-drops"><path class="wx-d1" d="M8.5 18v2.5"/><path class="wx-d2" d="M12.5 18v2.5"/><path class="wx-d3" d="M16.5 18v2.5"/></g>',
    cloudRain:
      '<g class="wx-drift"><path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/></g><g class="wx-drops"><path class="wx-d1" d="M8.5 17l-1.2 3.2"/><path class="wx-d2" d="M12.8 17l-1.2 3.2"/><path class="wx-d3" d="M17.1 17l-1.2 3.2"/></g>',
    cloudLightning:
      '<g class="wx-drift"><path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/></g><g class="wx-flash"><path d="M12.5 14.5l-2.8 4.2h2.6l-1.2 3.3 4-6h-2.7l1.6-2.8z" fill="currentColor" stroke="none"/></g>',
    cloudSnow:
      '<g class="wx-drift"><path d="M7 15h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 8.4 3.5 3.5 0 0 0 7 15z"/></g><g class="wx-flakes"><circle class="wx-f1" cx="9" cy="18.5" r="1" fill="currentColor" stroke="none"/><circle class="wx-f2" cx="13" cy="19.5" r="1" fill="currentColor" stroke="none"/><circle class="wx-f3" cx="17" cy="18.5" r="1" fill="currentColor" stroke="none"/></g>',
    cloudHail:
      '<g class="wx-drift"><path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/></g><g class="wx-flakes"><circle class="wx-f1" cx="9" cy="18.5" r="1.1"/><circle class="wx-f2" cx="13.5" cy="19.5" r="1.1"/><circle class="wx-f3" cx="17" cy="18" r="1.1"/></g>',
    pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    home: '<path d="M4 11.2L12 4l8 7.2"/><path d="M6.2 9.8V20h11.6V9.8"/>',
    map: '<path d="M9 4L3.5 5.8v14L9 18l6 1.8 5.5-1.8v-14L15 5.8 9 4z"/><path d="M9 4v14M15 5.8v14"/>',
    bell: '<path d="M6.5 16v-5.2a5.5 5.5 0 0 1 11 0V16l1.4 2.6H5.1z"/><path d="M10.2 21a2 2 0 0 0 3.6 0"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2"/>',
    user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0"/>',
    heart: '<path d="M12 20.5S3.5 15 3.5 9.3A4.6 4.6 0 0 1 8.2 4.7c1.7 0 3 .9 3.8 2.2a4.9 4.9 0 0 1 3.8-2.2 4.6 4.6 0 0 1 4.7 4.6c0 5.7-8.5 11.2-8.5 11.2z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21"/>',
    alert: '<path d="M12 3l10 17H2z"/><path d="M12 10v4M12 17.5v.01"/>',
    wind: '<path d="M3 8h9.5a2.8 2.8 0 1 0-2.8-2.8M3 12h13.5a2.8 2.8 0 1 1-2.8 2.8M3 16h7"/>',
    drop: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
    thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.3a4.5 4.5 0 1 1-4 0z"/><circle cx="12" cy="18" r="1.6"/>',
    gauge: '<path d="M4.5 19a8.5 8.5 0 1 1 15 0"/><path d="M12 14l4.2-4.2"/><circle cx="12" cy="14" r="1.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    sunrise: '<path d="M12 4v5M8.8 6.8L12 3.6l3.2 3.2"/><path d="M4 15h16"/><path d="M7 19h10"/><path d="M5.5 15a6.5 6.5 0 0 1 13 0"/>',
    sunset: '<path d="M12 3.6V9M8.8 6.2L12 9.4l3.2-3.2"/><path d="M4 15h16"/><path d="M7 19h10"/><path d="M5.5 15a6.5 6.5 0 0 1 13 0"/>',
  }[name] || '<circle cx="12" cy="12" r="8"/>';
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

module.exports = { icon };

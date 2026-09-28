// Hand-drawn inline SVG weather icons (no icon library, no emoji dependency).
"use strict";

function icon(name, cls) {
  const c = cls || "wicon";
  const inner = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/>',
    moon: '<path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z"/>',
    cloudSun:
      '<circle cx="7.5" cy="7.5" r="2.8"/><path d="M7.5 1.5v1.6M1.5 7.5h1.6M3.3 3.3l1.1 1.1M11.7 3.3l-1.1 1.1"/><path d="M8 20h9.5a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 8.4 14.6 3 3 0 0 0 8 20z"/>',
    cloudMoon: '<path d="M18.5 3.5a5 5 0 1 0 3 9"/><path d="M7 21h9.5a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 7.4 15.6 3 3 0 0 0 7 21z"/>',
    cloud: '<path d="M7 20h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 13.4 3.5 3.5 0 0 0 7 20z"/>',
    cloudFog: '<path d="M7 16h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 9.4 3.5 3.5 0 0 0 7 16z"/><path d="M4 19h16M6 22h12"/>',
    cloudDrizzle:
      '<path d="M7 15h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 8.4 3.5 3.5 0 0 0 7 15z"/><path d="M8 18v2.5M12 18v2.5M16 18v2.5"/>',
    cloudRain:
      '<path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/><path d="M8 17l-1 3M12.5 17l-1 3M17 17l-1 3"/>',
    cloudLightning:
      '<path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/><path d="M12 15l-2.5 4H12l-1 3 3.5-5.5H12l1.5-2.5z"/>',
    cloudSnow:
      '<path d="M7 15h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 8.4 3.5 3.5 0 0 0 7 15z"/><path d="M8 18.5v.01M12 19.5v.01M16 18.5v.01M10 21.5v.01M14 21.5v.01"/>',
    cloudHail:
      '<path d="M7 14h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7 7.4 3.5 3.5 0 0 0 7 14z"/><circle cx="9" cy="18.5" r="1.1"/><circle cx="13.5" cy="19.5" r="1.1"/><circle cx="17" cy="18" r="1.1"/>',
    pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    heart: '<path d="M12 20.5S3.5 15 3.5 9.3A4.6 4.6 0 0 1 8.2 4.7c1.7 0 3 .9 3.8 2.2a4.9 4.9 0 0 1 3.8-2.2 4.6 4.6 0 0 1 4.7 4.6c0 5.7-8.5 11.2-8.5 11.2z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21"/>',
    alert: '<path d="M12 3l10 17H2z"/><path d="M12 10v4M12 17.5v.01"/>',
    wind: '<path d="M3 8h9.5a2.8 2.8 0 1 0-2.8-2.8M3 12h13.5a2.8 2.8 0 1 1-2.8 2.8M3 16h7"/>',
    drop: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
    thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.3a4.5 4.5 0 1 1-4 0z"/><circle cx="12" cy="18" r="1.6"/>',
  }[name] || '<circle cx="12" cy="12" r="8"/>';
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

module.exports = { icon };

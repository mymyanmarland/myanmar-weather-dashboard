// Server-rendered inline SVG charts for AI reports. Zero JS dependency,
// print-safe (vector, no external resources), accessible via <title>.
// All text is escaped; Myanmar labels are browser-shaped (no server shaping).
"use strict";

const { esc } = require("../lib/format");

const INK = "#0f172a";
const MUTED = "#64748b";
const GRID = "#e2e8f0";
const NAVY = "#0b5cad";
const BLUE = "#2f80ed";
const BAND = "#bfdbfe";
const HIGH_C = "#dc2626";
const LOW_C = "#0284c7";
const PRECIP = "#3b82f6";
const WIND_C = "#0d9488";

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}${uidCounter}`;
}

function yangonParts(iso, opts) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", ...opts }).format(new Date(iso));
}

/** Short bilingual weekday label for a date string, e.g. {en:"Mon", my:"တနင်္လာ"}. */
function weekdayLabel(dateStr, lang) {
  try {
    const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    const en = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Yangon" }).format(d);
    const my = new Intl.DateTimeFormat("my-MM-u-nu-latn", { weekday: "short", timeZone: "Asia/Yangon" }).format(d);
    return lang === "my" ? my : en;
  } catch {
    return "—";
  }
}

function dayNum(dateStr) {
  try {
    const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Asia/Yangon" }).format(d);
  } catch {
    return "";
  }
}

function fmtT(v) {
  return v === null || v === undefined ? "—" : `${Math.round(v)}°`;
}

function gridLines(x0, x1, yFor, ticks, w) {
  return ticks
    .map(
      (t) =>
        `<line x1="${x0}" y1="${yFor(t.v)}" x2="${x1}" y2="${yFor(t.v)}" stroke="${GRID}" stroke-width="1"/>` +
        `<text x="${x0 - 8}" y="${yFor(t.v) + 4}" text-anchor="end" font-size="11" fill="${MUTED}">${esc(t.label)}</text>`,
    )
    .join("");
}

/**
 * 7-day temperature range: high/low band + average line.
 * daily: [{date, highC, lowC, ...}]
 */
function tempRangeChart(daily, lang) {
  const W = 680;
  const H = 280;
  const padL = 44;
  const padR = 16;
  const padT = 22;
  const padB = 52;
  const days = daily.filter((d) => d.highC !== null && d.lowC !== null);
  if (!days.length) return "";
  const all = days.flatMap((d) => [d.highC, d.lowC]);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const step = days.length > 1 ? iw / (days.length - 1) : 0;
  const X = (i) => padL + i * step;
  const Y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;

  const top = days.map((d, i) => `${X(i).toFixed(1)},${Y(d.highC).toFixed(1)}`).join(" ");
  const bot = days
    .map((d, i) => `${X(days.length - 1 - i).toFixed(1)},${Y(days[days.length - 1 - i].lowC).toFixed(1)}`)
    .join(" ");
  const avg = days
    .map((d, i) => `${X(i).toFixed(1)},${Y(((d.highC + d.lowC) / 2)).toFixed(1)}`)
    .join(" ");

  const nTicks = 4;
  const ticks = [];
  for (let i = 0; i <= nTicks; i++) {
    const v = lo + ((hi - lo) * i) / nTicks;
    ticks.push({ v, label: `${Math.round(v)}°C` });
  }

  const gid = uid("trg");
  const pts = days
    .map((d, i) => {
      const lbl = d.date ? `<text x="${X(i).toFixed(1)}" y="${H - 30}" text-anchor="middle" font-size="12" fill="${INK}">${esc(weekdayLabel(d.date, lang))}</text>
        <text x="${X(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="11" fill="${MUTED}">${esc(dayNum(d.date))}</text>` : "";
      const hv = `<text x="${X(i).toFixed(1)}" y="${(Y(d.highC) - 7).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${HIGH_C}">${fmtT(d.highC)}</text>`;
      const lv = `<text x="${X(i).toFixed(1)}" y="${(Y(d.lowC) + 16).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${LOW_C}">${fmtT(d.lowC)}</text>`;
      return `${lbl}${hv}${lv}<circle cx="${X(i).toFixed(1)}" cy="${Y(d.highC).toFixed(1)}" r="3.5" fill="${HIGH_C}"/><circle cx="${X(i).toFixed(1)}" cy="${Y(d.lowC).toFixed(1)}" r="3.5" fill="${LOW_C}"/>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="7-day temperature range chart" style="display:block;height:auto">
  <title>7-day temperature range</title>
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${BLUE}" stop-opacity="0.45"/><stop offset="1" stop-color="${BLUE}" stop-opacity="0.12"/>
  </linearGradient></defs>
  ${gridLines(padL, W - padR, Y, ticks, W)}
  <polygon points="${top} ${bot}" fill="url(#${gid})" stroke="none"/>
  <polyline points="${avg}" fill="none" stroke="${NAVY}" stroke-width="2.5" stroke-linejoin="round"/>
  ${pts}
</svg>`;
}

/** Smooth a point list with Catmull-Rom → cubic Bezier. */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * 24-hour temperature curve.
 * hourly: [{time, temperatureC, ...}]
 */
function hourlyTempChart(hourly, lang) {
  const W = 680;
  const H = 230;
  const padL = 44;
  const padR = 16;
  const padT = 24;
  const padB = 34;
  const pts = hourly.filter((h) => h.temperatureC !== null && h.time);
  if (pts.length < 2) return "";
  const vals = pts.map((h) => h.temperatureC);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 3) {
    const mid = (hi + lo) / 2;
    lo = mid - 1.5;
    hi = mid + 1.5;
  }
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const X = (i) => padL + (i / (pts.length - 1)) * iw;
  const Y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const coords = pts.map((h, i) => [X(i), Y(h.temperatureC)]);
  const line = smoothPath(coords);
  const area = `${line}L${X(pts.length - 1).toFixed(1)},${(padT + ih).toFixed(1)}L${X(0).toFixed(1)},${(padT + ih).toFixed(1)}Z`;

  const ticks = [];
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    ticks.push({ v, label: `${Math.round(v)}°C` });
  }

  const hourMarks = pts
    .map((h, i) => {
      if (i % 3 !== 0) return "";
      const lbl = yangonParts(h.time, { hour: "2-digit", hour12: false });
      return `<text x="${X(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="${MUTED}">${esc(lbl)}</text>
        <line x1="${X(i).toFixed(1)}" y1="${padT + ih}" x2="${X(i).toFixed(1)}" y2="${padT + ih + 5}" stroke="${MUTED}" stroke-width="1"/>`;
    })
    .join("");

  const imax = vals.indexOf(hi);
  const imin = vals.indexOf(lo);
  const gid = uid("hg");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="24-hour temperature curve" style="display:block;height:auto">
  <title>24-hour temperature</title>
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f59e0b" stop-opacity="0.4"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0.05"/>
  </linearGradient></defs>
  ${gridLines(padL, W - padR, Y, ticks, W)}
  <path d="${area}" fill="url(#${gid})" stroke="none"/>
  <path d="${line}" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="${X(imax).toFixed(1)}" cy="${Y(hi).toFixed(1)}" r="4" fill="${HIGH_C}"/>
  <text x="${X(imax).toFixed(1)}" y="${(Y(hi) - 10).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="${HIGH_C}">${fmtT(hi)}</text>
  <circle cx="${X(imin).toFixed(1)}" cy="${Y(lo).toFixed(1)}" r="4" fill="${LOW_C}"/>
  <text x="${X(imin).toFixed(1)}" y="${(Y(lo) + 20).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="${LOW_C}">${fmtT(lo)}</text>
  ${hourMarks}
</svg>`;
}

/**
 * 7-day precipitation probability bars.
 */
function precipChart(daily, lang) {
  const W = 330;
  const H = 230;
  const padL = 40;
  const padR = 12;
  const padT = 26;
  const padB = 36;
  const days = daily.filter((d) => d.precipitationProb !== null);
  if (!days.length) return "";
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const n = days.length;
  const slot = iw / n;
  const bw = Math.min(34, slot * 0.55);
  const X = (i) => padL + i * slot + (slot - bw) / 2;
  const Y = (v) => padT + ih - (v / 100) * ih;
  const ticks = [0, 25, 50, 75, 100].map((v) => ({ v, label: `${v}%` }));

  const bars = days
    .map((d, i) => {
      const v = d.precipitationProb;
      const h = (v / 100) * ih;
      const y = padT + ih - h;
      const alpha = 0.35 + (v / 100) * 0.65;
      const lbl = d.date ? `<text x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="11" fill="${MUTED}">${esc(weekdayLabel(d.date, lang))}</text>` : "";
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="4" fill="${PRECIP}" fill-opacity="${alpha.toFixed(2)}"/>
        <text x="${(X(i) + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${Math.round(v)}%</text>${lbl}`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="7-day rain probability bar chart" style="display:block;height:auto">
  <title>Rain probability</title>
  ${gridLines(padL, W - padR, Y, ticks, W)}
  ${bars}
</svg>`;
}

/**
 * 7-day max wind bars (km/h).
 */
function windChart(daily, lang) {
  const W = 330;
  const H = 230;
  const padL = 40;
  const padR = 12;
  const padT = 26;
  const padB = 36;
  const days = daily.filter((d) => d.windKmh !== null);
  if (!days.length) return "";
  const maxV = Math.max(...days.map((d) => d.windKmh), 10);
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const n = days.length;
  const slot = iw / n;
  const bw = Math.min(34, slot * 0.55);
  const X = (i) => padL + i * slot + (slot - bw) / 2;
  const Y = (v) => padT + ih - (v / maxV) * ih;
  const ticks = [0, 0.5, 1].map((f) => ({ v: maxV * f, label: `${Math.round(maxV * f)}` }));

  const bars = days
    .map((d, i) => {
      const v = d.windKmh;
      const h = (v / maxV) * ih;
      const y = padT + ih - h;
      const lbl = d.date ? `<text x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="11" fill="${MUTED}">${esc(weekdayLabel(d.date, lang))}</text>` : "";
      return `<rect x="${X(i).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="4" fill="${WIND_C}" fill-opacity="0.8"/>
        <text x="${(X(i) + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${Math.round(v)}</text>${lbl}`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="7-day max wind bar chart" style="display:block;height:auto">
  <title>Max wind (km/h)</title>
  ${gridLines(padL, W - padR, Y, ticks, W)}
  ${bars}
</svg>`;
}

module.exports = { tempRangeChart, hourlyTempChart, precipChart, windChart };

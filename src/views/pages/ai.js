// AI pages: hub, setup, reports list, report detail, print view.
// All render in the dash shell (rail + topbar); bilingual; server-rendered.
"use strict";

const { esc } = require("../../lib/format");
const { icon } = require("../icons");
const { codeInfo, iconKeyFor } = require("../../weather/codes");
const { render: renderMd, escHtml } = require("../../ai/markdown");
const { MODELS, DEFAULT_API_BASE } = require("../../ai/models");
const { mask } = require("../../ai/crypto");
const { parseSnapshot } = require("../../ai/snapshot");
const { tempRangeChart, hourlyTempChart, precipChart, windChart } = require("../../ai/charts");

function loginCard(ctx) {
  const { t } = ctx;
  return `<section class="card center">
    <p class="bigicon" aria-hidden="true">${icon("sparkles", "wicon xl")}</p>
    <h1>${esc(t("ai.title"))}</h1>
    <p class="muted">${esc(t("ai.loginRequired"))}</p>
    <p><a class="btn btn-primary" href="/login?next=/ai">${esc(t("ai.loginCta"))}</a></p>
  </section>`;
}

function typeCards(ctx, current) {
  const { t } = ctx;
  const types = [
    ["weather-prediction", t("ai.weatherPrediction"), t("ai.weatherPredictionDesc")],
    ["climate-prediction", t("ai.climatePrediction"), t("ai.climatePredictionDesc")],
    ["analysis", t("ai.analysis"), t("ai.analysisDesc")],
  ];
  return types.map(([v, label, desc]) => `
    <label class="aitype${v === current ? " sel" : ""}">
      <input type="radio" name="type" value="${v}"${v === current ? " checked" : ""} required>
      <span class="aitype-title">${esc(label)}</span>
      <span class="aitype-desc">${esc(desc)}</span>
    </label>`).join("");
}

function modelOptions(ctx, current) {
  return MODELS.map((m) =>
    `<option value="${esc(m.name)}"${m.name === current ? " selected" : ""}>${esc(m.name)}</option>`).join("");
}

function locationOptions(ctx, locations, defaultLoc, currentId) {
  const { t, lang } = ctx;
  const name = (l) => (lang === "my" && l.nameMy ? l.nameMy : l.nameEn);
  let out = `<option value="default"${currentId === "default" ? " selected" : ""}>${esc(t("ai.useDefault"))} — ${esc(name(defaultLoc))}</option>`;
  for (const l of locations) {
    out += `<option value="${esc(l.id)}"${l.id === currentId ? " selected" : ""}>${esc(name(l))}</option>`;
  }
  return out;
}

function aiHubPage(ctx, data) {
  const { t } = ctx;
  if (!ctx.user) return loginCard(ctx);
  const { configured, defaultModel, locations, defaultLoc, reports } = data;
  const setupBanner = configured
    ? ""
    : `<div class="flash warn" role="status">${esc(t("ai.setupNeeded"))} <a href="/ai/setup">${esc(t("ai.setupNow"))}</a></div>`;
  const reportItems = (reports || []).map((r) => `
    <li class="reportrow">
      <a href="/ai/reports/${r.id}"><b>${esc(typeLabel(ctx, r.type))}</b> · ${esc(r.location_name)} <span class="muted small">${esc(r.created_at.slice(0, 16).replace("T", " "))}</span></a>
    </li>`).join("");
  return `
  <p class="muted pagelead">${esc(t("ai.subtitle"))}</p>
  ${setupBanner}
  <section class="card">
    <h2 class="cardtitle">${esc(t("ai.title"))}</h2>
    <form method="post" action="/api/ai/analyze" class="aiform" onsubmit="var b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent=${JSON.stringify(t("ai.generating"))};">
      <div class="aitypes" role="radiogroup" aria-label="${esc(t("ai.type"))}">${typeCards(ctx, "weather-prediction")}</div>
      <div class="formgrid2">
        <label>${esc(t("ai.location"))}
          <select name="locationId">${locationOptions(ctx, locations, defaultLoc, "default")}</select>
        </label>
        <label>${esc(t("ai.model"))}
          <select name="model">${modelOptions(ctx, defaultModel)}</select>
        </label>
      </div>
      <div><button class="btn btn-primary" type="submit" ${configured ? "" : "disabled"}>${icon("sparkles", "wicon sm")} ${esc(t("ai.generate"))}</button>
      ${configured ? "" : `<a class="btn btn-ghost" href="/ai/setup">${esc(t("ai.setupNow"))}</a>`}</div>
    </form>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("ai.recentReports"))}</h2>
    ${reportItems ? `<ul class="reportlist">${reportItems}</ul><p><a class="btn btn-ghost btn-sm" href="/ai/reports">${esc(t("ai.reports"))}</a></p>` : `<p class="muted">${esc(t("ai.noReports"))}</p>`}
  </section>`;
}

function typeLabel(ctx, type) {
  const { t } = ctx;
  return type === "weather-prediction" ? t("ai.weatherPrediction")
    : type === "climate-prediction" ? t("ai.climatePrediction")
    : t("ai.analysis");
}

function aiSetupPage(ctx, data) {
  const { t } = ctx;
  const { config, ephemeral } = data;
  const saved = config && config.api_key_enc;
  const baseVal = (config && config.api_base) || process.env.AI_API_BASE || DEFAULT_API_BASE;
  return `
  <p class="muted pagelead">${esc(t("ai.setupSubtitle"))}</p>
  ${ephemeral ? `<div class="flash warn" role="status">${esc(t("ai.ephemeralWarn"))}</div>` : ""}
  <section class="card">
    <h2 class="cardtitle">${esc(t("ai.setupTitle"))}</h2>
    <form method="post" action="/ai/setup" class="formgrid" autocomplete="off" id="aisetup">
      <label>${esc(t("ai.apiBase"))}
        <input type="url" name="api_base" value="${esc(baseVal)}" required maxlength="200" placeholder="${esc(DEFAULT_API_BASE)}">
      </label>
      <label>${esc(t("ai.apiKey"))}
        ${saved ? `<div class="keymasked">${esc(t("ai.keySaved"))}: <code>${esc(mask("x".repeat(4) + (config.key_last4 || "")))}</code></div>` : ""}
        <input type="password" name="api_key" ${saved ? "" : "required"} autocomplete="new-password" maxlength="500" placeholder="${esc(t("ai.apiKeyPlaceholder"))}">
        <span class="muted small">${esc(t("ai.replaceKey"))}</span>
      </label>
      <label>${esc(t("ai.defaultModel"))}
        <select name="default_model">${modelOptions(ctx, (config && config.default_model) || "claude-sonnet-5")}</select>
      </label>
      <div class="btnrow">
        <button class="btn btn-primary" type="submit">${esc(t("ai.save"))}</button>
        <button class="btn btn-ghost" type="button" id="aitest">${esc(t("ai.test"))}</button>
        <span id="aitestout" class="muted small" role="status" aria-live="polite"></span>
      </div>
    </form>
  </section>
  <script>
  (function(){
    var b = document.getElementById('aitest'), out = document.getElementById('aitestout'), f = document.getElementById('aisetup');
    if (!b) return;
    b.addEventListener('click', function(){
      var base = f.api_base.value.trim(), key = f.api_key.value, model = f.default_model.value;
      if (!key) { out.textContent = ${JSON.stringify(t("ai.noKeyError"))}; return; }
      out.textContent = ${JSON.stringify(t("ai.testing"))}; b.disabled = true;
      fetch('/api/ai/test', {method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({api_base: base, api_key: key, model: model})})
        .then(function(r){ return r.json(); })
        .then(function(j){
          out.textContent = j.ok
            ? ${JSON.stringify(t("ai.testOk"))} + ' (' + ${JSON.stringify(t("ai.latency"))} + ' ' + j.latencyMs + 'ms)'
            : ${JSON.stringify(t("ai.testFailed"))} + ': ' + (j.error || j.kind || '');
          b.disabled = false;
        })
        .catch(function(e){ out.textContent = ${JSON.stringify(t("ai.testFailed"))} + ': ' + e; b.disabled = false; });
    });
  })();
  </script>`;
}

function aiReportsPage(ctx, { reports }) {
  const { t } = ctx;
  const items = (reports || []).map((r) => `
    <li class="reportrow">
      <a href="/ai/reports/${r.id}"><b>${esc(typeLabel(ctx, r.type))}</b> · ${esc(r.location_name)} · <span class="muted">${esc(r.model)}</span>
      <span class="muted small">${esc(String(r.created_at).slice(0, 16).replace("T", " "))}</span></a>
      <form class="inlineform" method="post" action="/ai/reports/${r.id}/delete" onsubmit="return confirm(${JSON.stringify(t("ai.deleteConfirm"))})">
        <button class="btn btn-ghost btn-sm danger" type="submit">${esc(t("ai.delete"))}</button>
      </form>
    </li>`).join("");
  return `
  <section class="card">
    <h2 class="cardtitle">${esc(t("ai.reports"))}</h2>
    ${items ? `<ul class="reportlist">${items}</ul>` : `<p class="muted">${esc(t("ai.noReports"))}</p>`}
    <p><a class="btn btn-ghost" href="/ai">${esc(t("ai.backToAi"))}</a></p>
  </section>`;
}

function aiReportPage(ctx, { report }) {
  const { t } = ctx;
  const snap = parseSnapshot(report.data_json);
  return `
  ${reportDoc(ctx, report, snap, false)}
  <div class="btnrow rpt-actions">
    <a class="btn btn-primary" href="/ai/reports/${report.id}/print" target="_blank" rel="noopener">${icon("sparkles", "wicon sm")} ${esc(t("ai.print"))}</a>
    <form class="inlineform" method="post" action="/ai/reports/${report.id}/delete" onsubmit="return confirm(${JSON.stringify(t("ai.deleteConfirm"))})">
      <button class="btn btn-ghost danger" type="submit">${esc(t("ai.delete"))}</button>
    </form>
    <a class="btn btn-ghost" href="/ai">${esc(t("ai.backToAi"))}</a>
  </div>`;
}

// ---------------------------------------------------------------------------
// Professional report document (shared by screen + print).
// ---------------------------------------------------------------------------

function condLabel(ctx, code) {
  return ctx.t("weather." + codeInfo(code == null ? -1 : code).labelKey);
}

function dayLabel(dateStr, lang) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
  try {
    const loc = lang === "my" ? "my-MM-u-nu-latn" : "en-GB";
    return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Yangon" }).format(d);
  } catch {
    return dateStr;
  }
}

function fmtVal(v, suffix) {
  return v === null || v === undefined ? "—" : `${Math.round(v)}${suffix || ""}`;
}

function kpiStats(snap) {
  const days = snap.daily.filter((d) => d.highC !== null && d.lowC !== null);
  const avg7 = days.length ? days.reduce((s, d) => s + (d.highC + d.lowC) / 2, 0) / days.length : null;
  const rain7 = days.reduce((s, d) => s + (d.precipitationMm || 0), 0);
  const windMax = days.length ? Math.max(...days.map((d) => d.windKmh || 0)) : null;
  const freq = {};
  days.forEach((d) => {
    if (d.weatherCode !== null && d.weatherCode !== undefined) freq[d.weatherCode] = (freq[d.weatherCode] || 0) + 1;
  });
  const domCode = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
  return { days, avg7, rain7, windMax, domCode: domCode !== undefined ? Number(domCode) : null };
}

function kpiCards(ctx, snap) {
  const { t } = ctx;
  const c = snap.current || {};
  const { avg7, rain7, windMax, domCode } = kpiStats(snap);
  const card = (ic, label, value, sub) => `
    <div class="rpt-kpi">
      <span class="rpt-kpi-ic">${icon(ic, "wicon lg")}</span>
      <span class="rpt-kpi-label">${esc(label)}</span>
      <span class="rpt-kpi-val">${value}</span>
      ${sub ? `<span class="rpt-kpi-sub">${sub}</span>` : ""}
    </div>`;
  const feelsSub = c.feelsLikeC !== null && c.feelsLikeC !== undefined
    ? esc(`${t("weather.feelsLike")} ${fmtVal(c.feelsLikeC, "°C")}`) : "";
  const domSub = domCode !== null ? condIcon(domCode, true, "wicon md") : "";
  return `
  <section class="rpt-kpis" aria-label="${esc(t("ai.dataSection"))}">
    ${card("thermo", t("ai.kpiNow"), c.temperatureC !== null && c.temperatureC !== undefined ? esc(fmtVal(c.temperatureC, "°C")) : "—", feelsSub)}
    ${card("sun", t("ai.kpiTodayHL"), `${fmtVal(c.highC, "°")} / ${fmtVal(c.lowC, "°")}`, "")}
    ${card("gauge", t("ai.kpiAvg7"), avg7 !== null ? esc(fmtVal(avg7, "°C")) : "—", "")}
    ${card("drop", t("ai.kpiRain7"), esc((Math.round(rain7 * 10) / 10) + " mm"), "")}
    ${card("wind", t("ai.kpiWindMax"), windMax !== null ? esc(fmtVal(windMax, " km/h")) : "—", "")}
    ${card("cloudSun", t("ai.kpiDominant"), domCode !== null ? esc(condLabel(ctx, domCode)) : "—", domSub)}
  </section>`;
}

function condIcon(code, isDay, cls) {
  return icon(iconKeyFor(code == null ? -1 : code, !!isDay), cls || "wicon md");
}

function chartsSection(ctx, snap) {
  const { t, lang } = ctx;
  const tr = tempRangeChart(snap.daily, lang);
  const hr = hourlyTempChart(snap.hourly, lang);
  const pr = precipChart(snap.daily, lang);
  const wn = windChart(snap.daily, lang);
  const fig = (title, svgHtml) => svgHtml
    ? `<figure class="rpt-chart"><figcaption>${esc(title)}</figcaption>${svgHtml}</figure>` : "";
  return `
  <section class="rpt-charts" aria-label="${esc(t("ai.dataSection"))}">
    <h2 class="rpt-sect">${esc(t("ai.dataSection"))}</h2>
    ${fig(t("ai.chartTempRange"), tr)}
    ${fig(t("ai.chartHourly"), hr)}
    <div class="rpt-duo">
      ${fig(t("ai.chartPrecip"), pr)}
      ${fig(t("ai.chartWind"), wn)}
    </div>
  </section>`;
}

function dailyTable(ctx, snap) {
  const { t, lang } = ctx;
  const rows = snap.daily.map((d) => `
    <tr>
      <td><b>${esc(dayLabel(d.date, lang))}</b></td>
      <td><span class="rpt-cond">${condIcon(d.weatherCode, true, "wicon sm")} ${esc(condLabel(ctx, d.weatherCode))}</span></td>
      <td class="num hi">${fmtVal(d.highC, "°")}</td>
      <td class="num lo">${fmtVal(d.lowC, "°")}</td>
      <td class="num">${d.precipitationProb !== null ? Math.round(d.precipitationProb) + "%" : "—"}</td>
      <td class="num">${d.precipitationMm !== null ? (Math.round(d.precipitationMm * 10) / 10) + " mm" : "—"}</td>
      <td class="num">${d.windKmh !== null ? Math.round(d.windKmh) + " km/h" : "—"}</td>
    </tr>`).join("");
  return `
  <section class="rpt-tablewrap">
    <h2 class="rpt-sect">${esc(t("ai.dailySection"))}</h2>
    <table class="rpt-table">
      <thead><tr>
        <th>${esc(t("ai.thDay"))}</th><th>${esc(t("ai.thCondition"))}</th>
        <th class="num">${esc(t("ai.thHigh"))}</th><th class="num">${esc(t("ai.thLow"))}</th>
        <th class="num">${esc(t("ai.thRainProb"))}</th><th class="num">${esc(t("ai.thRainMm"))}</th>
        <th class="num">${esc(t("ai.thWind"))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function climatePanel(ctx, snap) {
  const { t, lang } = ctx;
  const cl = snap.climate;
  const { avg7, rain7 } = kpiStats(snap);
  const zoneName = lang === "my" ? cl.zoneMy : cl.zoneEn;
  const seasonName = lang === "my" ? cl.seasonMy : cl.seasonEn;
  const monthName = lang === "my" ? snap.monthMy : snap.monthEn;

  let tempNote = t("ai.nearNormalTemp");
  if (avg7 !== null && cl.normalTempC !== null) {
    const diff = avg7 - cl.normalTempC;
    if (diff >= 1) tempNote = t("ai.warmerThan").replace("{v}", (Math.round(diff * 10) / 10).toString());
    else if (diff <= -1) tempNote = t("ai.coolerThan").replace("{v}", (Math.round(-diff * 10) / 10).toString());
  }
  let rainNote = t("ai.nearNormalRain");
  const prorated = (cl.normalRainMm || 0) / 30 * 7;
  if (cl.normalRainMm === 0 && rain7 < 2) rainNote = t("ai.nearNormalRain");
  else if (prorated > 0) {
    const ratio = rain7 / prorated;
    if (ratio >= 1.5) rainNote = t("ai.wetterThan");
    else if (ratio <= 0.5) rainNote = t("ai.drierThan");
  } else if (rain7 >= 10) rainNote = t("ai.wetterThan");

  const row = (label, normal, outlook) => `
    <tr><td>${esc(label)}</td><td class="num">${esc(normal)}</td><td class="num"><b>${esc(outlook)}</b></td></tr>`;
  return `
  <section class="rpt-climate">
    <h2 class="rpt-sect">${esc(t("ai.climateSection"))}</h2>
    <p class="rpt-climate-zone">${icon("map", "wicon sm")} <b>${esc(zoneName)}</b> · ${esc(seasonName)}</p>
    <table class="rpt-table rpt-climate-table">
      <thead><tr><th></th><th class="num">${esc(t("ai.climateNormal").replace("{month}", monthName))}</th><th class="num">${esc(t("ai.climateOutlook"))}</th></tr></thead>
      <tbody>
        ${row(t("ai.kpiAvg7"), cl.normalTempC !== null ? fmtVal(cl.normalTempC, "°C") : "—", avg7 !== null ? fmtVal(avg7, "°C") : "—")}
        ${row(t("ai.kpiRain7"), cl.normalRainMm !== null ? `${Math.round(cl.normalRainMm)} mm/${lang === "my" ? "လ" : "mo"}` : "—", `${Math.round(rain7 * 10) / 10} mm/7${lang === "my" ? "ရက်" : "d"}`)}
      </tbody>
    </table>
    <p class="rpt-anomaly"><b>${esc(t("ai.climateAnomaly"))}:</b> ${esc(tempNote)} · ${esc(rainNote)}</p>
  </section>`;
}

function reportDoc(ctx, report, snap, standalone) {
  const { t, lang } = ctx;
  const ref = `RPT-${String(report.id).padStart(6, "0")}`;
  const locName = [report.location_name].filter(Boolean).join("");
  const locMy = snap && snap.location.nameMy ? ` / ${snap.location.nameMy}` : "";
  const days = snap ? snap.daily.filter((d) => d.date) : [];
  const period = days.length
    ? `${dayLabel(days[0].date, lang)} — ${dayLabel(days[days.length - 1].date, lang)}`
    : "—";
  const generated = snap ? `${esc(snap.generatedAtYangon)} (UTC+6:30)` : esc(String(report.created_at).slice(0, 16).replace("T", " "));

  const metaItem = (label, value) => `
    <div class="rpt-meta-item"><span class="rpt-meta-label">${esc(label)}</span><span class="rpt-meta-val">${value}</span></div>`;

  return `
<div class="rpt">
  <header class="rpt-head">
    <div class="rpt-head-top">
      <span class="rpt-badge">${icon("sparkles", "wicon sm")} ${esc(typeLabel(ctx, report.type))}</span>
      <span class="rpt-ref">${esc(t("ai.reportRef"))}: ${esc(ref)}</span>
    </div>
    <h1 class="rpt-title">${esc(typeLabel(ctx, report.type))}</h1>
    <p class="rpt-loc">${icon("pin", "wicon sm")} ${esc(locName)}${esc(locMy)}</p>
    <div class="rpt-meta">
      ${metaItem(t("ai.period"), esc(period))}
      ${metaItem(t("ai.generatedAt"), generated)}
      ${metaItem(t("ai.model"), esc(report.model || "—"))}
      ${metaItem(t("ai.analysisBy"), esc("Myanmar Weather Dashboard"))}
    </div>
  </header>
  <div class="rpt-body">
    ${snap ? kpiCards(ctx, snap) : `<div class="rpt-legacy notice">${esc(t("ai.legacyCharts"))}</div>`}
    ${snap ? chartsSection(ctx, snap) : ""}
    ${snap ? dailyTable(ctx, snap) : ""}
    ${snap ? climatePanel(ctx, snap) : ""}
    <section class="rpt-narrative">
      <h2 class="rpt-sect">${esc(t("ai.analysisSection"))}</h2>
      <div class="rpt-md">${renderMd(report.markdown)}</div>
    </section>
  </div>
  <footer class="rpt-foot">
    <span>${esc(t("ai.dataSources"))}</span>
    <span>${esc(t("ai.disclaimer"))}</span>
  </footer>
</div>`;
}

/**
 * Standalone print-optimized professional A4 report.
 * NOTE: server-side PDF libraries cannot shape Myanmar script correctly,
 * so we render a clean print page and let the browser do Print → Save as
 * PDF, which renders Myanmar text perfectly.
 */
function aiPrintPage(ctx, { report }) {
  const { t, lang } = ctx;
  const snap = parseSnapshot(report.data_json);
  const title = `${typeLabel(ctx, report.type)} — ${report.location_name}`;
  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 12mm 11mm 16mm 11mm;
    @bottom-center {
      content: "${esc(t("ai.reportRef"))} · " counter(page) " / " counter(pages);
      font-size: 8.5pt; color: #64748b;
      font-family: "Noto Sans Myanmar", "Myanmar3", "Padauk", system-ui, sans-serif;
    }
  }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Noto Sans Myanmar", "Myanmar3", "Padauk", system-ui, -apple-system, sans-serif; margin: 0; color: #0f172a; background: #fff; line-height: 1.65; font-size: 11pt; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #0b3d6e; color: #fff; padding: 10px 18px; display: flex; gap: 12px; align-items: center; }
  .toolbar button { background: #fff; color: #0b3d6e; border: 0; border-radius: 8px; padding: 9px 20px; font-size: 14px; cursor: pointer; font-weight: 700; font-family: inherit; }
  .toolbar span { font-size: 13px; opacity: .85; }
  .rpt { max-width: 190mm; margin: 8mm auto 12mm; }
  .rpt-head { background: linear-gradient(135deg, #0b5cad 0%, #0b3d6e 70%, #082a4e 100%); color: #fff; border-radius: 10px; padding: 22px 24px; margin-bottom: 14px; }
  .rpt-head-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
  .rpt-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.35); padding: 4px 12px; border-radius: 999px; font-size: 9.5pt; font-weight: 600; }
  .rpt-badge .wicon { width: 15px; height: 15px; }
  .rpt-ref { font-size: 9pt; opacity: .8; letter-spacing: .04em; }
  .rpt-title { margin: 0 0 4px; font-size: 21pt; letter-spacing: -.01em; }
  .rpt-loc { margin: 0 0 12px; font-size: 11.5pt; opacity: .92; display: flex; align-items: center; gap: 6px; }
  .rpt-loc .wicon { width: 16px; height: 16px; }
  .rpt-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border-top: 1px solid rgba(255,255,255,.25); padding-top: 10px; }
  .rpt-meta-label { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
  .rpt-meta-val { display: block; font-size: 10pt; font-weight: 600; margin-top: 2px; }
  .rpt-sect { font-size: 13.5pt; color: #0b3d6e; border-bottom: 2.5px solid #0b5cad; padding-bottom: 4px; margin: 20px 0 10px; break-after: avoid; }
  .rpt-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0 4px; }
  .rpt-kpi { break-inside: avoid; border: 1px solid #dbe4ee; border-left: 4px solid #0b5cad; border-radius: 8px; padding: 10px 12px; background: #f8fafc; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 10px; align-items: center; }
  .rpt-kpi-ic { grid-row: 1 / 4; color: #0b5cad; }
  .rpt-kpi-ic .wicon { width: 30px; height: 30px; }
  .rpt-kpi-label { font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .rpt-kpi-val { font-size: 16pt; font-weight: 800; color: #0f172a; line-height: 1.2; }
  .rpt-kpi-sub { font-size: 9pt; color: #64748b; display: flex; align-items: center; gap: 4px; }
  .rpt-kpi-sub .wicon { width: 16px; height: 16px; }
  .rpt-charts .rpt-chart, .rpt-duo .rpt-chart { break-inside: avoid; }
  .rpt-chart { border: 1px solid #dbe4ee; border-radius: 8px; padding: 12px 14px 8px; margin: 0 0 12px; background: #fff; }
  .rpt-chart figcaption { font-size: 10.5pt; font-weight: 700; color: #0b3d6e; margin-bottom: 6px; }
  .rpt-chart svg text { font-family: inherit; }
  .rpt-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rpt-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .rpt-table th, .rpt-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  .rpt-table thead { display: table-header-group; }
  .rpt-table thead th { background: #0b3d6e; color: #fff; font-size: 9pt; }
  .rpt-table tbody tr:nth-child(even) { background: #f1f5f9; }
  .rpt-table tbody tr { break-inside: avoid; }
  .rpt-table td.num, .rpt-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .rpt-table td.hi { color: #dc2626; font-weight: 700; }
  .rpt-table td.lo { color: #0284c7; font-weight: 700; }
  .rpt-cond { display: inline-flex; align-items: center; gap: 6px; }
  .rpt-cond .wicon { width: 18px; height: 18px; color: #0b5cad; }
  .rpt-climate { break-inside: avoid; border: 1px solid #dbe4ee; border-radius: 8px; padding: 4px 16px 12px; background: #f8fafc; margin-top: 6px; }
  .rpt-climate-zone { display: flex; align-items: center; gap: 6px; font-size: 10.5pt; }
  .rpt-climate-zone .wicon { width: 16px; height: 16px; color: #0b5cad; }
  .rpt-anomaly { font-size: 10pt; background: #eff6ff; border-left: 4px solid #0b5cad; padding: 8px 12px; border-radius: 0 6px 6px 0; }
  .rpt-legacy { margin: 12px 0; }
  .rpt-narrative .rpt-md h2 { font-size: 13pt; color: #0b3d6e; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 18px 0 8px; break-after: avoid; }
  .rpt-narrative .rpt-md h3 { font-size: 11.5pt; color: #14467e; margin: 14px 0 6px; break-after: avoid; }
  .rpt-narrative .rpt-md h4 { font-size: 10.5pt; margin: 10px 0 4px; }
  .rpt-narrative .rpt-md p, .rpt-narrative .rpt-md li { font-size: 10.5pt; }
  .rpt-narrative .rpt-md ul, .rpt-narrative .rpt-md ol { padding-left: 20px; }
  .rpt-narrative .rpt-md li { margin-bottom: 3px; }
  .rpt-narrative .rpt-md table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 8px 0; }
  .rpt-narrative .rpt-md th, .rpt-narrative .rpt-md td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  .rpt-narrative .rpt-md thead th { background: #e8f1fb; }
  .rpt-narrative .rpt-md thead { display: table-header-group; }
  .rpt-narrative .rpt-md tr { break-inside: avoid; }
  .rpt-narrative .rpt-md hr { border: 0; border-top: 1px solid #cbd5e1; margin: 14px 0; }
  .rpt-foot { margin-top: 18px; border-top: 2px solid #0b5cad; padding-top: 8px; display: flex; justify-content: space-between; gap: 12px; font-size: 8.5pt; color: #64748b; }
  @media print {
    .toolbar { display: none !important; }
    .rpt { max-width: none; margin: 0; }
    body { font-size: 10.5pt; }
  }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">${esc(t("ai.downloadPdf"))}</button><span>A4 · ${esc(t("ai.print"))}</span></div>
${reportDoc(ctx, report, snap, true)}
</body>
</html>`;
}

module.exports = { aiHubPage, aiSetupPage, aiReportsPage, aiReportPage, aiPrintPage, typeLabel };

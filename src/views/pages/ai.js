// AI pages: hub, setup, reports list, report detail, print view.
// All render in the dash shell (rail + topbar); bilingual; server-rendered.
"use strict";

const { esc } = require("../../lib/format");
const { icon } = require("../icons");
const { render: renderMd, escHtml } = require("../../ai/markdown");
const { MODELS, DEFAULT_API_BASE } = require("../../ai/models");
const { mask } = require("../../ai/crypto");

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
  return `
  <section class="card report">
    <div class="reportmeta muted small">
      <span><b>${esc(typeLabel(ctx, report.type))}</b></span> ·
      <span>${esc(report.location_name)}</span> ·
      <span>${esc(report.model)}</span> ·
      <span>${esc(t("ai.generatedAt"))}: ${esc(String(report.created_at).slice(0, 16).replace("T", " "))}</span>
    </div>
    <div class="reportbody">${renderMd(report.markdown)}</div>
    <div class="btnrow reportactions">
      <a class="btn btn-primary" href="/ai/reports/${report.id}/print" target="_blank" rel="noopener">${esc(t("ai.print"))}</a>
      <form class="inlineform" method="post" action="/ai/reports/${report.id}/delete" onsubmit="return confirm(${JSON.stringify(t("ai.deleteConfirm"))})">
        <button class="btn btn-ghost danger" type="submit">${esc(t("ai.delete"))}</button>
      </form>
      <a class="btn btn-ghost" href="/ai">${esc(t("ai.backToAi"))}</a>
    </div>
    <p class="muted small">${esc(t("ai.disclaimer"))}</p>
  </section>`;
}

/**
 * Standalone print-optimized bilingual A4 report.
 * NOTE: server-side PDF libraries cannot shape Myanmar script correctly,
 * so we render a clean print page and let the browser do Print → Save as
 * PDF, which renders Myanmar text perfectly.
 */
function aiPrintPage(ctx, { report }) {
  const { t, lang } = ctx;
  const title = `${typeLabel(ctx, report.type)} — ${report.location_name}`;
  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans Myanmar", "Myanmar3", "Padauk", system-ui, sans-serif; margin: 0; color: #111; background: #fff; line-height: 1.7; }
  .sheet { max-width: 210mm; margin: 0 auto; padding: 18mm 16mm; }
  .dochead { border-bottom: 3px solid #0b5cad; padding-bottom: 10px; margin-bottom: 14px; }
  .dochead h1 { font-size: 22px; margin: 0 0 4px; }
  .dochead .meta { color: #555; font-size: 12.5px; }
  .reportbody h2 { font-size: 19px; color: #0b5cad; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 26px; }
  .reportbody h3 { font-size: 16px; margin-top: 18px; }
  .reportbody h4 { font-size: 14.5px; }
  .reportbody p, .reportbody li { font-size: 13.5px; }
  .reportbody table { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 10px 0; }
  .reportbody th, .reportbody td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; }
  .reportbody th { background: #eef4fb; }
  .docfoot { margin-top: 26px; border-top: 1px solid #ccc; padding-top: 8px; color: #666; font-size: 11.5px; }
  .toolbar { position: sticky; top: 0; background: #0b5cad; color: #fff; padding: 10px 16px; display: flex; gap: 10px; align-items: center; }
  .toolbar button { background: #fff; color: #0b5cad; border: 0; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer; font-weight: 700; }
  @media print {
    .toolbar { display: none; }
    .sheet { padding: 0; max-width: none; }
    body { line-height: 1.6; }
  }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">${esc(t("ai.downloadPdf"))}</button><span>${esc(t("ai.print"))} · A4</span></div>
<div class="sheet">
  <div class="dochead">
    <h1>${esc(title)}</h1>
    <div class="meta">${esc(t("ai.generatedAt"))}: ${esc(String(report.created_at).slice(0, 16).replace("T", " "))} · ${esc(report.model)} · ${esc(report.location_name)}</div>
  </div>
  <div class="reportbody">${renderMd(report.markdown)}</div>
  <div class="docfoot">${esc(t("ai.disclaimer"))}</div>
</div>
</body>
</html>`;
}

module.exports = { aiHubPage, aiSetupPage, aiReportsPage, aiReportPage, aiPrintPage, typeLabel };

// Alerts page: derived alerts for all 12 cities + manual announcements + subscriptions.
"use strict";

const { esc } = require("../../lib/format");
const { alertCard } = require("../widgets");

const SEV_RANK = { emergency: 4, warning: 3, watch: 2, advisory: 1 };

function alertsPage(ctx, data) {
  const { t, lang, user } = ctx;
  const groups = (data.groups || []).filter((g) => g.alerts.length);
  const all = groups.flatMap((g) => g.alerts.map((a) => ({ ...a, _city: g.cityName })));
  all.sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));

  const alertsHtml = all.length
    ? `<div class="alertlist">${all.map((a) => alertCard(ctx, a)).join("")}</div>`
    : `<p class="notice">${esc(t("alertsPage.noAlerts"))}</p>`;

  const announceHtml = (data.announcements || []).length
    ? `<h2 class="subtitle">${esc(t("admin.announcementsTitle"))}</h2>
       <div class="alertlist">${data.announcements.map((a) => alertCard(ctx, {
         id: `ann-${a.id}`,
         title: { my: a.title_my, en: a.title_en },
         severity: a.severity,
         areas: [],
         startsAt: a.created_at,
         endsAt: null,
         description: { my: a.body_my, en: a.body_en },
         safetyActions: [],
         source: "manual",
         updatedAt: a.created_at,
       })).join("")}</div>`
    : "";

  let subHtml = "";
  if (user) {
    const subs = data.subscriptions || [];
    const rows = subs.length
      ? subs.map((s) => `<li class="subrow">
          <span><b>${esc(s.name_en)}</b> · ${esc(t(`alertsPage.severity.${s.severity_threshold}`))}</span>
          <form class="inlineform" method="post" action="/api/alert-subscriptions/${s.id}/delete">
            <button class="btn btn-ghost btn-sm" type="submit">${esc(t("alertsPage.removeSubscription"))}</button>
          </form>
        </li>`).join("")
      : `<li class="muted">${esc(t("alertsPage.noSubscriptions"))}</li>`;
    const sevOpts = ["advisory", "watch", "warning", "emergency"]
      .map((s) => `<option value="${s}">${esc(t(`alertsPage.severity.${s}`))}</option>`).join("");
    subHtml = `<section class="card">
      <h2 class="cardtitle">${esc(t("alertsPage.subscribe"))}</h2>
      <p class="muted small">${esc(t("alertsPage.subscribeDesc"))}</p>
      <ul class="sublist">${rows}</ul>
      <form method="post" action="/api/alert-subscriptions" class="formgrid">
        <label>${esc(t("alertsPage.subscribeFor"))}
          <input type="text" name="nameEn" required maxlength="120" placeholder="Yangon">
        </label>
        <label>Lat <input type="number" name="lat" step="any" required min="-90" max="90" placeholder="16.84"></label>
        <label>Lon <input type="number" name="lon" step="any" required min="-180" max="180" placeholder="96.17"></label>
        <label>${esc(t("alertsPage.minSeverity"))}
          <select name="severityThreshold">${sevOpts}</select>
        </label>
        <button class="btn btn-primary btn-sm" type="submit">${esc(t("alertsPage.addSubscription"))}</button>
      </form>
    </section>`;
  } else {
    subHtml = `<section class="card"><p class="muted">${esc(t("alertsPage.signInToSubscribe"))} <a href="/login">${esc(t("nav.login"))}</a></p></section>`;
  }

  return `
  <p class="muted pagelead">${esc(t("alertsPage.subtitle"))}</p>
  ${alertsHtml}
  ${announceHtml}
  ${subHtml}`;
}

module.exports = { alertsPage };

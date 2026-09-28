// Admin page: role-gated placeholder (MVP). Shows locations, users,
// announcements and provider fetch log — read-only.
"use strict";

const { esc, formatDateTime } = require("../../lib/format");
const { locationDisplayName } = require("../../lib/locations");

function adminPage(ctx, data) {
  const { t, lang, prefs, user } = ctx;
  if (!user) {
    return `<div class="pagehead"><div><h1>${esc(t("admin.title"))}</h1></div></div>
      <section class="card center"><p class="muted">${esc(t("admin.signInRequired"))}</p>
      <p><a class="btn btn-primary" href="/login">${esc(t("nav.login"))}</a></p></section>`;
  }
  if (user.role !== "admin") {
    return `<div class="pagehead"><div><h1>${esc(t("admin.title"))}</h1></div></div>
      <section class="card center"><p class="error">${esc(t("admin.notAdmin"))}</p></section>`;
  }

  const locRows = (data.locations || []).map((l) => {
    const name = lang === "my" ? l.name_my : l.name_en;
    const state = lang === "my" ? l.state_my : l.state_en;
    return `<tr><td>${esc(name)}</td><td>${esc(state)}</td><td class="num">${Number(l.lat).toFixed(2)}</td><td class="num">${Number(l.lon).toFixed(2)}</td></tr>`;
  }).join("");

  const userRows = (data.users || []).map((u) => `<tr><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(formatDateTime(u.created_at, lang, prefs.timeFormat))}</td></tr>`).join("");

  const annRows = (data.announcements || []).length
    ? data.announcements.map((a) => `<li class="subrow"><span><b>${esc(a["title_" + lang] || a.title_en)}</b> · <span class="badge">${a.is_published ? esc(t("admin.published")) : esc(t("admin.draft"))}</span></span></li>`).join("")
    : `<li class="muted">—</li>`;

  const fetchRows = (data.recentFetches || []).map((f) => `<tr>
    <td>${esc(f.kind)}</td><td class="mono small">${esc(f.location_key)}</td>
    <td>${f.ok ? '<span class="badge ok">OK</span>' : `<span class="badge bad">FAIL</span> <small>${esc(f.error || "")}</small>`}</td>
    <td class="small">${esc(formatDateTime(f.fetched_at, lang, prefs.timeFormat))}</td></tr>`).join("");

  return `
  <div class="pagehead"><div>
    <h1>${esc(t("admin.title"))}</h1>
    <p class="muted">${esc(t("admin.subtitle"))}</p>
    <p class="notice">${esc(t("admin.stubNote"))}</p>
  </div></div>
  <section class="card">
    <h2 class="cardtitle">${esc(t("admin.providerTitle"))}</h2>
    <table class="table"><thead><tr><th>kind</th><th>key</th><th>status</th><th>time</th></tr></thead>
    <tbody>${fetchRows || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("admin.locationsTitle"))}</h2>
    <table class="table"><thead><tr><th>name</th><th>state</th><th>lat</th><th>lon</th></tr></thead>
    <tbody>${locRows}</tbody></table>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("admin.announcementsTitle"))}</h2>
    <ul class="sublist">${annRows}</ul>
    <form method="post" action="/api/admin/announcements" class="formgrid">
      <label>${esc(t("admin.announcementTitle"))} (MY) <input type="text" name="titleMy" required maxlength="200"></label>
      <label>${esc(t("admin.announcementTitle"))} (EN) <input type="text" name="titleEn" required maxlength="200"></label>
      <label>${esc(t("admin.announcementBody"))} (MY) <textarea name="bodyMy" required maxlength="5000" rows="3"></textarea></label>
      <label>${esc(t("admin.announcementBody"))} (EN) <textarea name="bodyEn" required maxlength="5000" rows="3"></textarea></label>
      <label>${esc(t("alertsPage.minSeverity"))}
        <select name="severity">${["advisory", "watch", "warning", "emergency"].map((s) => `<option value="${s}">${esc(t(`alertsPage.severity.${s}`))}</option>`).join("")}</select>
      </label>
      <label class="check"><input type="checkbox" name="isPublished" value="1"> ${esc(t("admin.published"))}</label>
      <button class="btn btn-primary btn-sm" type="submit">${esc(t("admin.publish"))}</button>
    </form>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("admin.usersTitle"))}</h2>
    <table class="table"><thead><tr><th>email</th><th>role</th><th>created</th></tr></thead>
    <tbody>${userRows}</tbody></table>
  </section>`;
}

module.exports = { adminPage };

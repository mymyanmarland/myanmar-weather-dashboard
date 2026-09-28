// Settings page: language, units, time format, theme. Guests → cookies only;
// signed-in users → DB + cookies.
"use strict";

const { esc } = require("../../lib/format");

function radioGroup(ctx, name, options, current) {
  return `<div class="radiogroup" role="radiogroup" aria-label="${esc(name)}">${options.map(([v, label]) => `
    <label class="radio"><input type="radio" name="${esc(name)}" value="${esc(v)}"${v === current ? " checked" : ""}><span>${esc(label)}</span></label>`).join("")}</div>`;
}

function settingsPage(ctx) {
  const { t, prefs, user } = ctx;
  const note = user ? t("settings.accountNote") : t("settings.guestNote");
  return `
  <div class="pagehead"><div>
    <h1>${esc(t("settings.title"))}</h1>
    <p class="muted">${esc(t("settings.subtitle"))}</p>
    <p class="muted small">${esc(note)}</p>
  </div></div>
  <section class="card">
    <form method="post" action="/api/prefs" class="formgrid">
      <input type="hidden" name="redirect" value="/settings?ok=settings.saved">
      <div><h3 class="subtitle">${esc(t("settings.language"))}</h3>
        ${radioGroup(ctx, "language", [["my", t("settings.languageMy")], ["en", t("settings.languageEn")]], prefs.language)}</div>
      <div><h3 class="subtitle">${esc(t("settings.tempUnit"))}</h3>
        ${radioGroup(ctx, "tempUnit", [["c", t("settings.celsius")], ["f", t("settings.fahrenheit")]], prefs.tempUnit)}</div>
      <div><h3 class="subtitle">${esc(t("settings.windUnit"))}</h3>
        ${radioGroup(ctx, "windUnit", [["kmh", t("settings.kmh")], ["mph", t("settings.mph")], ["ms", t("settings.ms")]], prefs.windUnit)}</div>
      <div><h3 class="subtitle">${esc(t("settings.timeFormat"))}</h3>
        ${radioGroup(ctx, "timeFormat", [["12", t("settings.hour12")], ["24", t("settings.hour24")]], prefs.timeFormat)}</div>
      <div><h3 class="subtitle">${esc(t("settings.theme"))}</h3>
        ${radioGroup(ctx, "theme", [["light", t("settings.themeLight")], ["dark", t("settings.themeDark")], ["system", t("settings.themeSystem")]], prefs.theme)}</div>
      <div><button class="btn btn-primary" type="submit">${esc(t("common.save"))}</button></div>
    </form>
  </section>
  ${user ? `<section class="card">
    <h2 class="cardtitle">${esc(t("settings.accountSection"))}</h2>
    <p><b>${esc(user.name || "")}</b> · ${esc(user.email)}</p>
    <form class="inlineform" method="post" action="/logout"><button class="btn btn-ghost" type="submit">${esc(t("auth.signOut"))}</button></form>
    <form class="inlineform" method="post" action="/api/account/delete" onsubmit="return confirm(${JSON.stringify(t("auth.deleteAccountConfirm"))})">
      <button class="btn btn-ghost danger" type="submit">${esc(t("auth.deleteAccount"))}</button>
    </form>
  </section>
  <section class="card">
    <h2 class="cardtitle">${esc(t("auth.changePassword"))}</h2>
    <form method="post" action="/api/account/password" class="formgrid" autocomplete="off">
      <label>${esc(t("auth.currentPassword"))}
        <input type="password" name="currentPassword" required autocomplete="current-password" minlength="8" maxlength="128">
      </label>
      <label>${esc(t("auth.newPassword"))} <span class="muted small">(${esc(t("auth.passwordHint"))})</span>
        <input type="password" name="newPassword" required autocomplete="new-password" minlength="8" maxlength="128">
      </label>
      <label>${esc(t("auth.confirmPassword"))}
        <input type="password" name="confirmPassword" required autocomplete="new-password" minlength="8" maxlength="128">
      </label>
      <div><button class="btn btn-primary" type="submit">${esc(t("auth.changePassword"))}</button></div>
    </form>
  </section>` : ""}`;
}

module.exports = { settingsPage };

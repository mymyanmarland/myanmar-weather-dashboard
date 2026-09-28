// Login / signup forms (plain HTML forms, server-validated).
"use strict";

const { esc } = require("../../lib/format");

function authShell(ctx, inner) {
  return `<div class="authwrap"><section class="card">${inner}</section></div>`;
}

function nextField(ctx, data) {
  const nx = data && data.next && data.next !== "/" ? data.next : null;
  return nx ? `<input type="hidden" name="next" value="${esc(nx)}">` : "";
}

function nextQuery(ctx, data) {
  const nx = data && data.next && data.next !== "/" ? data.next : null;
  return nx ? `?next=${encodeURIComponent(nx)}` : "";
}

function loginPage(ctx, data) {
  const { t } = ctx;
  const err = data && data.error ? `<p class="formerror" role="alert">${esc(t(data.error))}</p>` : "";
  return authShell(ctx, `
    <h1>${esc(t("auth.loginTitle"))}</h1>
    <p class="muted">${esc(t("auth.loginSubtitle"))}</p>
    ${err}
    <form method="post" action="/login" class="formgrid">
      ${nextField(ctx, data)}
      <label>${esc(t("auth.email"))}
        <input type="email" name="email" required autocomplete="email" maxlength="254">
      </label>
      <label>${esc(t("auth.password"))}
        <input type="password" name="password" required autocomplete="current-password" minlength="8" maxlength="128">
      </label>
      <button class="btn btn-primary" type="submit">${esc(t("auth.signIn"))}</button>
    </form>
    <p class="muted">${esc(t("auth.noAccount"))} <a href="/signup${nextQuery(ctx, data)}">${esc(t("auth.signUp"))}</a></p>`);
}

function signupPage(ctx, data) {
  const { t } = ctx;
  const err = data && data.error ? `<p class="formerror" role="alert">${esc(t(data.error))}</p>` : "";
  return authShell(ctx, `
    <h1>${esc(t("auth.signupTitle"))}</h1>
    <p class="muted">${esc(t("auth.signupSubtitle"))}</p>
    ${err}
    <form method="post" action="/signup" class="formgrid">
      ${nextField(ctx, data)}
      <label>${esc(t("auth.name"))}
        <input type="text" name="name" autocomplete="name" maxlength="80">
      </label>
      <label>${esc(t("auth.email"))}
        <input type="email" name="email" required autocomplete="email" maxlength="254">
      </label>
      <label>${esc(t("auth.password"))}
        <input type="password" name="password" required autocomplete="new-password" minlength="8" maxlength="128">
        <small class="muted">${esc(t("auth.passwordHint"))}</small>
      </label>
      <button class="btn btn-primary" type="submit">${esc(t("auth.signUp"))}</button>
    </form>
    <p class="muted">${esc(t("auth.haveAccount"))} <a href="/login${nextQuery(ctx, data)}">${esc(t("auth.signIn"))}</a></p>`);
}

module.exports = { loginPage, signupPage };

// Base HTML shell. Every page renders through layout() — essential content is
// always in the server HTML (low-bandwidth requirement); client JS only
// enhances (search autocomplete, map, geolocation, recents).
"use strict";

const { esc } = require("../lib/format");
const { dashRail } = require("./widgets");

/** Inline script: apply theme class before first paint (no FOUC). */
function themeInitScript(prefs) {
  return `<script>(function(){try{var t="${prefs.theme}";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();</script>`;
}

function navLink(t, lang, href, key, active) {
  const cls = active === key ? "navlink active" : "navlink";
  return `<a class="${cls}" href="${href}"${active === key ? ' aria-current="page"' : ""}>${esc(t(`nav.${key}`))}</a>`;
}

/**
 * ctx: { lang, t, user, prefs, title, active, flash, scripts }
 * t is the bound translator: (key) => string
 */
function layout(ctx, bodyHtml) {
  const { lang, t, user, prefs, title, active } = ctx;
  const scripts = ctx.scripts || [];
  const flash = ctx.flash || null;
  // Dashboard shell mode (home page): icon rail instead of the top header.
  const dashMode = !!ctx.dash;
  const bodyCls = [ctx.bodyClass, dashMode ? "dashmode" : ""].filter(Boolean).join(" ");
  const bodyClass = bodyCls ? ` class="${esc(bodyCls)}"` : "";

  const langSwitch = `
    <form class="langswitch" method="post" action="/api/prefs" aria-label="${esc(t("settings.language"))}">
      <input type="hidden" name="redirect" value="${esc(ctx.path || "/")}">
      <input type="hidden" name="tempUnit" value="${esc(prefs.tempUnit)}">
      <input type="hidden" name="windUnit" value="${esc(prefs.windUnit)}">
      <input type="hidden" name="timeFormat" value="${esc(prefs.timeFormat)}">
      <input type="hidden" name="theme" value="${esc(prefs.theme)}">
      <button type="submit" name="language" value="my" class="langbtn${lang === "my" ? " active" : ""}" aria-pressed="${lang === "my"}">မြန်မာ</button>
      <button type="submit" name="language" value="en" class="langbtn${lang === "en" ? " active" : ""}" aria-pressed="${lang === "en"}">EN</button>
    </form>`;

  const authArea = user
    ? `<span class="userinfo">${esc(user.name || user.email)}</span>
       <form class="inlineform" method="post" action="/logout"><button class="btn btn-ghost btn-sm" type="submit">${esc(t("nav.logout"))}</button></form>`
    : `<a class="btn btn-ghost btn-sm" href="/login">${esc(t("nav.login"))}</a>
       <a class="btn btn-primary btn-sm" href="/signup">${esc(t("nav.signup"))}</a>`;

  const flashHtml = flash
    ? `<div class="flash ${esc(flash.kind)}" role="status">${esc(flash.text)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(t("meta.appName"))}</title>
<meta name="description" content="${esc(t("meta.tagline"))}">
<link rel="stylesheet" href="/css/style.css">
${themeInitScript(prefs)}
</head>
<body${bodyClass}>
<a class="skip" href="#main">${esc(t("common.viewAll")) === "View all" ? "Skip to content" : "အဓိကအကြောင်းအရာသို့ ကျော်ရန်"}</a>
${dashMode ? dashRail(ctx, ctx.alertCount || 0) : `<header class="siteheader">
  <div class="wrap headerrow">
    <a class="brand" href="/"><span class="brandmark">☀</span><span class="brandname">${esc(t("meta.appName"))}</span></a>
    <nav class="mainnav" aria-label="${esc(t("nav.menu"))}">
      ${navLink(t, lang, "/", "home", active)}
      ${navLink(t, lang, "/search", "search", active)}
      ${navLink(t, lang, "/alerts", "alerts", active)}
      ${navLink(t, lang, "/map", "map", active)}
      ${navLink(t, lang, "/favorites", "favorites", active)}
      ${navLink(t, lang, "/settings", "settings", active)}
      ${user && user.role === "admin" ? navLink(t, lang, "/admin", "admin", active) : ""}
    </nav>
    <div class="headeractions">${langSwitch}${authArea}</div>
  </div>
</header>`}
<main id="main" class="${dashMode ? "dashmain" : "wrap"}">${flashHtml}${bodyHtml}</main>
<footer class="sitefooter">
  <div class="wrap footerinner">
    <p>${esc(t("footer.tagline"))}</p>
    <p>${esc(t("footer.dataBy"))} <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
  </div>
</footer>
${scripts.map((s) => `<script src="${esc(s)}" defer></script>`).join("\n")}
</body>
</html>`;
}

/** Build the standard page context from req + db. */
function pageCtx(req, db, opts) {
  const { t } = require("../lib/i18n");
  const { resolvePrefs } = require("../lib/prefs");
  const prefs = resolvePrefs(req, db);
  const lang = prefs.language;
  const bound = (key) => t(lang, key);
  const ctx = {
    lang,
    t: bound,
    user: req.user || null,
    prefs,
    title: opts.title,
    active: opts.active || null,
    path: req.originalUrl || req.path || "/",
    scripts: opts.scripts || [],
    flash: null,
  };
  const q = req.query || {};
  if (q.ok) ctx.flash = { kind: "ok", text: bound(q.ok) || q.ok };
  if (q.err) ctx.flash = { kind: "err", text: bound(q.err) || q.err };
  return ctx;
}

module.exports = { layout, pageCtx };

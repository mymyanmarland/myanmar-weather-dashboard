// Auth routes: signup / login / logout (hand-rolled sessions).
"use strict";

const express = require("express");

const auth = require("../auth");
const validate = require("../lib/validate");
const { rateLimit } = require("../ratelimit");
const { layout, pageCtx } = require("../views/layout");
const { loginPage, signupPage } = require("../views/pages/auth");

const router = express.Router();

const authLimiter = rateLimit({ limit: 10, windowMs: 10 * 60 * 1000, keyPrefix: "auth" });

function dbOf(req) {
  return req.app.locals.db;
}

function safeNext(v) {
  const s = String(v || "/");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

router.post("/signup", authLimiter, (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "" });
  ctx.title = ctx.t("auth.signupTitle");
  const em = validate.email(req.body.email);
  const pw = validate.password(req.body.password);
  const nm = validate.name(req.body.name);
  const nx = safeNext(req.body.next || req.query.next);
  if (!em.ok) return res.status(422).send(layout(ctx, signupPage(ctx, { error: "auth.invalidEmail", next: nx })));
  if (!pw.ok) return res.status(422).send(layout(ctx, signupPage(ctx, { error: "auth.passwordTooShort", next: nx })));
  const taken = db.prepare("SELECT id FROM users WHERE email = ?").get(em.value);
  if (taken) return res.status(409).send(layout(ctx, signupPage(ctx, { error: "auth.emailTaken", next: nx })));
  try {
    const info = db.prepare(
      "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, 'user', ?)",
    ).run(em.value, nm.value || null, auth.hashPassword(pw.value), new Date().toISOString());
    const sess = auth.createSession(db, Number(info.lastInsertRowid));
    auth.setSessionCookie(res, sess.token, sess.expiresAt);
    return res.redirect(nx);
  } catch {
    return res.status(500).send(layout(ctx, signupPage(ctx, { error: "auth.signUpFailed", next: nx })));
  }
});

router.post("/login", authLimiter, (req, res) => {
  const db = dbOf(req);
  const ctx = pageCtx(req, db, { title: "" });
  ctx.title = ctx.t("auth.loginTitle");
  const em = validate.email(req.body.email);
  const pw = validate.password(req.body.password);
  const nx = safeNext(req.body.next || req.query.next);
  if (!em.ok || !pw.ok) {
    return res.status(422).send(layout(ctx, loginPage(ctx, { error: "auth.signInFailed", next: nx })));
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(em.value);
  if (!user || !auth.verifyPassword(pw.value, user.password_hash)) {
    // Same message either way: do not reveal whether the email exists.
    return res.status(401).send(layout(ctx, loginPage(ctx, { error: "auth.signInFailed", next: nx })));
  }
  const sess = auth.createSession(db, user.id);
  auth.setSessionCookie(res, sess.token, sess.expiresAt);
  return res.redirect(safeNext(req.body.next || req.query.next));
});

router.post("/logout", (req, res) => {
  const db = dbOf(req);
  const token = req.cookies ? req.cookies[auth.SESSION_COOKIE] : null;
  auth.destroySession(db, token);
  auth.clearSessionCookie(res);
  return res.redirect("/?ok=auth.signedOut");
});

module.exports = router;

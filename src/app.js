// Express app factory.
"use strict";

const express = require("express");
const path = require("path");

const auth = require("./auth");

function parseCookies(req, _res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(";")) {
      const i = part.indexOf("=");
      if (i > 0) {
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        try {
          req.cookies[k] = decodeURIComponent(v);
        } catch {
          req.cookies[k] = v;
        }
      }
    }
  }
  next();
}

function attachUser(db) {
  return (req, _res, next) => {
    const token = req.cookies ? req.cookies[auth.SESSION_COOKIE] : null;
    req.user = auth.getSessionUser(db, token);
    next();
  };
}

function createApp(db) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.locals.db = db;

  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(parseCookies);
  app.use(attachUser(db));
  app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h" }));

  app.use(require("./routes/auth"));
  app.use(require("./routes/api"));
  app.use(require("./routes/pages"));

  // 404
  app.use((req, res) => {
    const { layout, pageCtx } = require("./views/layout");
    const ctx = pageCtx(req, db, { title: "404" });
    res.status(404).send(layout(ctx, `<section class="card center"><h1>404</h1><p class="muted">${ctx.t("common.notFound")}</p><p><a class="btn btn-primary" href="/">${ctx.t("nav.home")}</a></p></section>`));
  });

  // 500 — never leak internals to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error("[request-error]", err && err.message);
    const { layout, pageCtx } = require("./views/layout");
    try {
      const ctx = pageCtx(req, req.app.locals.db, { title: "Error" });
      res.status(500).send(layout(ctx, `<section class="card center"><h1>${ctx.t("common.error")}</h1><p><a class="btn btn-primary" href="/">${ctx.t("common.retry")}</a></p></section>`));
    } catch {
      res.status(500).send("Something went wrong");
    }
  });

  return app;
}

module.exports = { createApp };

// Server entry: open DB (migrate + seed), wire the weather service, listen.
"use strict";

const path = require("path");

const { createApp } = require("./app");
const { openDb, adminUsesDefaultPassword, ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD } = require("./db");
const service = require("./weather/service");

const PORT = Number(process.env.PORT || 3200);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

const db = openDb(DATA_DIR);
service.setDb(db);

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`[weather] listening on http://localhost:${PORT}`);
  console.log(`[weather] data dir: ${DATA_DIR}`);
  if (adminUsesDefaultPassword(db)) {
    console.warn(
      `[weather] WARNING: the seeded admin account (${ADMIN_EMAIL}) still uses the default password "${ADMIN_DEFAULT_PASSWORD}". Change it before exposing this server.`,
    );
  }
});

// SQLite persistence via node:sqlite (DatabaseSync). WAL mode.
// Schema is created on boot; seed data (locations, admin) is applied idempotently.
"use strict";

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const { MYANMAR_LOCATIONS } = require("./lib/locations");
const { hashPassword } = require("./auth");

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEFAULT_PASSWORD = "admin123";

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "app.db");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_my TEXT NOT NULL,
      state_en TEXT NOT NULL,
      state_my TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorite_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      location_id TEXT,
      name_en TEXT NOT NULL,
      name_my TEXT NOT NULL DEFAULT '',
      state_en TEXT NOT NULL DEFAULT '',
      state_my TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_locations(user_id, sort_order);
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT 'my',
      temp_unit TEXT NOT NULL DEFAULT 'c',
      wind_unit TEXT NOT NULL DEFAULT 'kmh',
      time_format TEXT NOT NULL DEFAULT '24',
      theme TEXT NOT NULL DEFAULT 'system'
    );
    CREATE TABLE IF NOT EXISTS alert_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name_en TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      severity_threshold TEXT NOT NULL DEFAULT 'advisory',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON alert_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS weather_alerts (
      id TEXT PRIMARY KEY,
      area_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS manual_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_my TEXT NOT NULL,
      title_en TEXT NOT NULL,
      body_my TEXT NOT NULL,
      body_en TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'advisory',
      is_published INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weather_fetch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      location_key TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      ok INTEGER NOT NULL,
      error TEXT
    );
  `);
}

function seed(db) {
  // Locations: upsert the 12 seeded cities.
  const upsertLoc = db.prepare(`
    INSERT INTO locations (id, name_en, name_my, state_en, state_my, lat, lon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name_en=excluded.name_en, name_my=excluded.name_my,
      state_en=excluded.state_en, state_my=excluded.state_my,
      lat=excluded.lat, lon=excluded.lon
  `);
  for (const l of MYANMAR_LOCATIONS) {
    upsertLoc.run(l.id, l.nameEn, l.nameMy, l.stateEn, l.stateMy, l.lat, l.lon);
  }

  // Admin seed (idempotent): create only when missing.
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL);
  if (!existing) {
    db.prepare(
      "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
    ).run(ADMIN_EMAIL, "Administrator", hashPassword(ADMIN_DEFAULT_PASSWORD), new Date().toISOString());
  }
}

/** True when the admin account still uses the shipped default password. */
function adminUsesDefaultPassword(db) {
  try {
    const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get(ADMIN_EMAIL);
    if (!row) return false;
    const { verifyPassword } = require("./auth");
    return verifyPassword(ADMIN_DEFAULT_PASSWORD, row.password_hash);
  } catch {
    return false;
  }
}

module.exports = { openDb, adminUsesDefaultPassword, ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD };

// Hand-rolled auth (Tech Stack 2): scrypt password hashing + random session
// tokens in httpOnly, SameSite=Lax cookies. Sessions live in the sqlite
// `sessions` table. This module never requires db.js at top level — the db
// handle is passed into each function (db.js requires this module for hashing).
"use strict";

const crypto = require("node:crypto");

const SESSION_COOKIE = "mw_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts[0] !== "scrypt" || parts.length !== 6) return false;
    const [, saltHex, hashHex, n, r, p] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createSession(db, userId) {
  const token = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(token, userId, expiresAt, now.toISOString());
  // Opportunistic cleanup of expired sessions.
  try {
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString());
  } catch {
    /* ignore */
  }
  return { token, expiresAt };
}

function getSessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    try {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    } catch {
      /* ignore */
    }
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at };
}

function destroySession(db, token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
};

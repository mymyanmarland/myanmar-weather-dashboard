// AES-256-GCM encryption for user-supplied AI API keys.
//
// The key is derived from the AI_KEY_SECRET env var (via scrypt). When the
// env var is unset, a random per-boot key is generated instead — API keys
// then stop decrypting after a restart. isEphemeral() exposes this so the
// UI can show a non-blocking warning (Render Free has an ephemeral
// filesystem anyway, so the DB itself doesn't survive restarts either).
//
// Envelope: "gcm1:<iv-b64>:<tag-b64>:<ct-b64>". NEVER log plaintext keys.
"use strict";

const crypto = require("crypto");

let _key = null;
let _ephemeral = false;

function secretKey() {
  if (_key) return _key;
  const s = process.env.AI_KEY_SECRET || "";
  if (s) {
    _key = crypto.scryptSync(s, "mw-ai-config-v1", 32);
    _ephemeral = false;
  } else {
    _key = crypto.randomBytes(32);
    _ephemeral = true;
  }
  return _key;
}

/** True when no AI_KEY_SECRET is set (keys won't survive a restart). */
function isEphemeral() {
  secretKey();
  return _ephemeral;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["gcm1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

function decrypt(blob) {
  const parts = String(blob || "").split(":");
  if (parts.length !== 4 || parts[0] !== "gcm1") throw new Error("bad envelope");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(parts[1], "base64"));
  decipher.setAuthTag(Buffer.from(parts[2], "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]);
  return pt.toString("utf8");
}

/** Last-4 display helper: "••••" + last4, never the full key. */
function mask(key) {
  const k = String(key || "");
  if (k.length <= 4) return "••••";
  return "••••" + k.slice(-4);
}

module.exports = { encrypt, decrypt, mask, isEphemeral };

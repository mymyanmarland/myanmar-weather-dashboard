// Tiny in-memory rate limiter: fixed windows per key.
"use strict";

const buckets = new Map(); // key -> { count, resetAt }

function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

// Periodic cleanup so the map cannot grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref();

/** Express middleware factory: limit requests per client IP. */
function rateLimit({ limit, windowMs, keyPrefix }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const r = hit(`${keyPrefix}:${ip}`, limit, windowMs);
    if (!r.allowed) {
      res.status(429);
      if (req.path.startsWith("/api/")) {
        return res.json({ error: "rateLimited" });
      }
      return res.send("Too many requests. Please wait a moment and try again.");
    }
    next();
  };
}

module.exports = { rateLimit, hit };

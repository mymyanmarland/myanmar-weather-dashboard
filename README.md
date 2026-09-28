# Myanmar Weather Dashboard — Tech Stack 2

Bilingual (မြန်မာ / English) weather dashboard for Myanmar. Built with **Tech Stack 2**:
Node.js + Express backend, `node:sqlite` persistence, vanilla JS frontend rendered
server-side (no build step, no TypeScript, no frontend framework). Weather data from
[Open-Meteo](https://open-meteo.com/) (free, no API key).

## Quick start

Requires **Node.js 22.5+** (`node:sqlite`).

```bash
npm install
npm start
```

Open http://localhost:3200 (override with `PORT=3200`). The SQLite database is
created at `data/app.db` on first boot (WAL mode, gitignored).

On boot the database is migrated and seeded:

- the 12 major cities (Yangon, Mandalay, Naypyidaw, Bago, Mawlamyine, Pathein,
  Taunggyi, Sittwe, Myitkyina, Monywa, Dawei, Hpa-An)
- an admin account: **admin@example.com / admin123**

> ⚠️ The server prints a boot warning while the admin account still uses the
> default password. There is no password-change UI in the MVP — rotate it by
> deleting and re-creating the account, or update the hash directly in sqlite.

## Features (MVP)

- Home dashboard: current conditions, 24-hour hourly forecast, 7-day daily
  forecast (expandable), 12-city national overview, derived severe-weather alerts
- Location search: local 12-city search first, then Open-Meteo geocoding
  (Myanmar-biased), recent locations in localStorage for guests, approximate
  geolocation with denied/unavailable/timeout states
- Alerts page: derived alerts (thunderstorm, flood/heavy rain, heat, wind, cold)
  across all 12 cities + manual admin announcements; registered users can
  subscribe per location with a severity threshold
- Map page: Leaflet via CDN, loaded **only** when the user clicks "load map";
  temperature / rain / wind / alert layers; graceful fallback message
- Favorites (registered users): full CRUD, set default, reorder (up/down),
  compare current conditions across favorites
- Settings: language (my/en, default my), temperature (°C/°F), wind (km/h,
  mph, m/s), time format (12/24h), theme (light/dark/system). Guests → cookies +
  localStorage; users → database (+ cookies for rendering)
- Auth: hand-rolled — scrypt password hashing, random session tokens in
  httpOnly `SameSite=Lax` cookies, 30-day sessions, role-based access
  (user/admin), account deletion
- Admin placeholder (admin role only): supported locations, users, announcement
  publishing, provider fetch log
- Resilience: server-side cache with TTLs (current 10 min, forecasts 1 h,
  alerts 30 min); provider failure → last-known-good with a clear stale-data
  indicator; `weather_fetch_log` table records every attempt
- Rate limiting (in-memory): auth endpoints 10/10 min, geocode 30/min per IP

## Deferred / not in MVP

- **Email** (verification, password reset, alert emails): there is no mail
  provider in Tech Stack 2. Account signup signs users in directly.
- Password change / reset UI.
- Admin management UI is a read-only placeholder (+ announcement publishing).
- Phase 2 features: push notifications, agricultural insights, travel planner,
  historical data, advanced map layers, PWA, community reports, public display
  mode, partner API.

## Project layout

```
src/
  server.js        entry: boots DB, seeds, starts Express
  app.js           Express app factory + middleware
  db.js            node:sqlite schema, seed, admin check
  auth.js          scrypt hashing, session tokens/cookies
  ratelimit.js     in-memory rate limiter
  lib/             i18n.js (my/en dictionaries), locations.js, format.js,
                   prefs.js (cookie/DB preference resolution), validate.js
  weather/         open-meteo.js (provider + geocode), codes.js (WMO codes +
                   alert derivation), service.js (TTL cache + stale fallback)
  views/           layout.js, widgets.js, icons.js, pages/*.js (HTML templates)
  routes/          pages.js (GET), auth.js (signup/login/logout), api.js
public/
  css/style.css    hand-written, mobile-first, dark mode via .dark
  js/              search.js, recent.js, geo.js, map.js (vanilla, no build)
data/              app.db (created on boot, gitignored)
```

## Security notes

- Passwords: scrypt (N=16384, r=8, p=1, 64-byte key), random 16-byte salt,
  `crypto.timingSafeEqual` compare.
- Sessions: 32-byte random hex tokens, httpOnly + SameSite=Lax, 30-day expiry,
  stored server-side; expired sessions are pruned on login.
- All mutations validate input server-side; coordinates are range-checked;
  error pages never leak internals.
- CSRF: mitigated via SameSite=Lax on the session cookie. Dedicated CSRF tokens
  are a hardening TODO before public deployment.

## Testing

```bash
# syntax-check all server + client JS
for f in $(find src public/js -name '*.js'); do node --check "$f" || break; done
```

Manual smoke test (server running on :3200):

```bash
curl -s http://localhost:3200/ | grep -o 'ရန်ကုန်' | head -1
curl -s http://localhost:3200/api/geocode?q=taunggyi | head -c 200
# auth round-trip
curl -s -c /tmp/jar -X POST -d 'email=t@t.mm&password=password123&name=Test' http://localhost:3200/signup -o /dev/null -w '%{http_code}\n'
curl -s -b /tmp/jar http://localhost:3200/favorites -o /dev/null -w '%{http_code}\n'
```

# AI Climate / Weather Prediction & Analysis — setup notes

The `/ai` section generates **climate prediction, weather prediction and
analysis** for Myanmar locations using the user's own AI credentials through
their custom gateway. All AI calls run **server-side** — the browser never
talks to the gateway and never sees the API key.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `AI_API_BASE` | `https://claude-n-codex.com:8443/v1` | Gateway root for all AI API calls (server-side default; each user can override it in `/ai/setup`). |
| `AI_KEY_SECRET` | *(random per boot)* | Secret used to AES-256-GCM-encrypt stored API keys. **Set this in production** — without it, saved keys stop decrypting after every restart (the UI shows a warning). Any long random string works. |
| `AI_DAILY_LIMIT` | `10` | Max AI analyses per user per day. |

## Models (registry: `src/ai/models.js`)

All five go through the custom base URL; `provider` selects the wire format:

| name | provider | model id |
|---|---|---|
| claude-sonnet-5 | anthropic (Messages API) | claude-sonnet-5 |
| claude-opus-5 | anthropic (Messages API) | claude-opus-5 |
| claude-fable-5.1 | anthropic (Messages API) | claude-fable-5.1 |
| claude-fable-5 | anthropic (Messages API) | claude-fable-5 |
| gpt-5.6-sol | anthropic (Messages API) | gpt-5.6-sol |

## What the user must do

1. Sign in, open **AI** (sparkle icon in the rail) → **Set up AI key** (`/ai/setup`).
2. Paste the API key, confirm the base URL (`https://claude-n-codex.com:8443/v1`),
   pick a default model → **Save**. Keys are stored AES-256-GCM encrypted;
   the UI only ever shows `••••1234`.
3. Optionally **Test connection** (sends a tiny "reply OK" probe server-side).
4. Pick analysis type + location + model → **Generate**. Reports are saved
   under **My reports**; each has a **Print / PDF** view (browser
   Print → Save as PDF renders Myanmar script perfectly — server-side PDF
   libraries cannot shape Myanmar text, hence the print-page approach).

## Grounding

Every prompt includes live data (current + 24h hourly + 7-day daily +
active alerts from the existing weather service) plus
`src/ai/climate-knowledge.js` — Myanmar seasons, 6 climate zones with
monthly normals, cyclone seasons, monsoon onset/withdrawal, El Niño/La Niña
effects, agricultural calendar. Output is bilingual Markdown
(`## မြန်မာ` then `## English`), rendered through a safe renderer
(`src/ai/markdown.js` — no raw HTML passthrough).

## Security notes

- API keys: encrypted at rest, never logged, never rendered into HTML/JSON.
- `/api/ai/analyze` is login-only, per-user daily-limited, and IP rate-limited.
- `src/weather/` fallback logic is untouched.

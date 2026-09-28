// Provider adapters: server-side AI calls only.
//
// SECURITY: the frontend NEVER talks to the AI gateway directly. Every
// request below runs in Node, and API keys are only ever sent in outbound
// HTTPS headers — never logged, never echoed, never rendered into HTML.
//
// Wire formats:
//   anthropic → POST {base}/messages  (x-api-key + anthropic-version)
//   openai    → POST {base}/chat/completions (Authorization: Bearer)
"use strict";

const REQUEST_TIMEOUT_MS = 90000;

class ProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // invalidKey | notFound | rateLimited | timeout | provider | network
  }
}

function mapStatus(status, bodyText) {
  if (status === 401 || status === 403) {
    return new ProviderError("invalidKey", "Gateway rejected the API key (401/403). Check the key in /ai/setup.");
  }
  if (status === 404) {
    return new ProviderError("notFound", "Model or endpoint not found (404). Check the model name and base URL.");
  }
  if (status === 429) {
    return new ProviderError("rateLimited", "Gateway rate-limited the request (429). Wait a moment and retry.");
  }
  const hint = String(bodyText || "").slice(0, 200);
  return new ProviderError("provider", `Gateway error ${status}${hint ? ": " + hint : ""}`);
}

/** POST JSON with a timeout and one retry on 5xx / network failures. */
async function postJson(url, headers, body) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) {
          lastErr = mapStatus(res.status, text);
          continue; // retry once on 5xx
        }
        throw mapStatus(res.status, text);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError("provider", "Gateway returned non-JSON output.");
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ProviderError) throw err;
      const isTimeout = err && (err.name === "AbortError" || /abort/i.test(String(err.message)));
      lastErr = new ProviderError(isTimeout ? "timeout" : "network",
        isTimeout ? "Request timed out after 90s." : `Network error: ${err && err.message ? err.message : err}`);
      if (attempt === 0) continue; // retry once on network failure
      throw lastErr;
    }
  }
  throw lastErr;
}

function asTextBlocks(content) {
  if (!Array.isArray(content)) return "";
  return content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n").trim();
}

async function anthropicChat({ apiBase, apiKey, model, messages, maxTokens }) {
  const base = String(apiBase).replace(/\/+$/, "");
  const json = await postJson(`${base}/messages`, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }, {
    model,
    max_tokens: maxTokens || 4000,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = asTextBlocks(json.content);
  if (!text) throw new ProviderError("provider", "Gateway returned an empty reply.");
  return text;
}

async function openaiChat({ apiBase, apiKey, model, messages, maxTokens }) {
  const base = String(apiBase).replace(/\/+$/, "");
  const json = await postJson(`${base}/chat/completions`, {
    authorization: `Bearer ${apiKey}`,
  }, {
    model,
    max_tokens: maxTokens || 4000,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = json && json.choices && json.choices[0] && json.choices[0].message
    ? String(json.choices[0].message.content || "").trim() : "";
  if (!text) throw new ProviderError("provider", "Gateway returned an empty reply.");
  return text;
}

/**
 * Single entry point. `model` is a registry entry {provider, model}.
 * Returns the assistant's plain-text reply. Throws ProviderError.
 */
async function chat({ provider, model, apiBase, apiKey, messages, maxTokens, system }) {
  const withSystem = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;
  if (provider === "anthropic") {
    // Anthropic Messages API takes `system` as a top-level field; the
    // custom gateway also accepts it inline, so pass both forms safely.
    return anthropicChatWithSystem({ apiBase, apiKey, model, messages, maxTokens, system });
  }
  if (provider === "openai") return openaiChat({ apiBase, apiKey, model, messages: withSystem, maxTokens });
  throw new ProviderError("provider", `Unknown provider "${provider}".`);
}

async function anthropicChatWithSystem({ apiBase, apiKey, model, messages, maxTokens, system }) {
  const base = String(apiBase).replace(/\/+$/, "");
  const body = {
    model,
    max_tokens: maxTokens || 4000,
    messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
  };
  if (system) body.system = system;
  const json = await postJson(`${base}/messages`, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }, body);
  const text = asTextBlocks(json.content);
  if (!text) throw new ProviderError("provider", "Gateway returned an empty reply.");
  return text;
}

/** Tiny probe used by the "test connection" button. Resolves {ok, latencyMs}. */
async function probe({ provider, model, apiBase, apiKey }) {
  const started = Date.now();
  try {
    const reply = await chat({
      provider, model, apiBase, apiKey, maxTokens: 16,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    });
    return { ok: true, latencyMs: Date.now() - started, reply: reply.slice(0, 120) };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, kind: err.kind || "error", error: err.message };
  }
}

module.exports = { chat, probe, ProviderError, REQUEST_TIMEOUT_MS };

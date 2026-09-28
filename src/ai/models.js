// AI model registry for the Myanmar Weather Dashboard.
//
// All models are reached through the user's own custom gateway
// (default https://claude-n-codex.com:8443/v1, overridable via the
// AI_API_BASE env var or per-user in the /ai/setup UI).
//
// `provider` selects the HTTP API wire format:
//   - "anthropic" → Anthropic Messages API  (POST {base}/messages)
//   - "openai"    → OpenAI Chat Completions (POST {base}/chat/completions)
// NOTE: per the user's gateway config, gpt-5.6-sol is served through the
// Anthropic Messages format on the custom base URL, so its provider is
// "anthropic" even though the model id looks like a GPT model.
"use strict";

const DEFAULT_API_BASE = "https://claude-n-codex.com:8443/v1";

/** Gateway root for API calls. Env AI_API_BASE wins; trailing slashes trimmed. */
function apiBase() {
  const v = String(process.env.AI_API_BASE || "").trim().replace(/\/+$/, "");
  return v || DEFAULT_API_BASE;
}

const MODELS = [
  { name: "claude-sonnet-5", provider: "anthropic", model: "claude-sonnet-5", roles: ["chat", "edit", "apply"] },
  { name: "claude-opus-5", provider: "anthropic", model: "claude-opus-5", roles: ["chat", "edit", "apply"] },
  { name: "claude-fable-5.1", provider: "anthropic", model: "claude-fable-5.1", roles: ["chat", "edit", "apply"] },
  { name: "claude-fable-5", provider: "anthropic", model: "claude-fable-5", roles: ["chat", "edit", "apply"] },
  { name: "gpt-5.6-sol", provider: "anthropic", model: "gpt-5.6-sol", roles: ["chat", "edit", "apply"] },
];

/** Find a registered model by name; null when unknown. */
function getModel(name) {
  return MODELS.find((m) => m.name === String(name)) || null;
}

module.exports = { MODELS, getModel, apiBase, DEFAULT_API_BASE };

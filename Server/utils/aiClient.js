// Multi-provider LLM router with automatic model discovery.
//
// Built to run unattended: no model names need to be maintained in code.
//   * Every provider exposes an OpenAI-compatible /chat/completions endpoint and is used only when
//     its API key is set.
//   * Models are DISCOVERED from each provider's live model list (refreshed every 12h, and right
//     after a "model not found" error). Deprecated / soon-to-expire / non-chat models are dropped and
//     the rest are ranked by family, size and version. Stable "-latest" aliases are tried first.
//     If discovery fails, a built-in fallback list is used.
//   * For each call the candidates (provider × model) are tried in order. A failing candidate is put
//     on a cooldown sized to the failure and the next one is tried immediately. When everything is
//     cooling down we still try the candidates that recover first.
//
// Configuration (Server/.env), all optional:
//   GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY[_<ROLE>]
//   AI_PROVIDER_ORDER  default "groq,gemini,mistral,openrouter,cerebras"
//   AI_ROUTING         "priority" (best available first, default) or "spread" (rotate providers)
//   <PROVIDER>_MODELS  pin exact models for a provider and skip discovery, e.g. GROQ_MODELS
//   AI_TIMEOUT_MS      per-request timeout, default 30000

const DAY = 24 * 60 * 60 * 1000;
const DISCOVERY_TTL_MS = 12 * 60 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 5000;
const MODELS_PER_PROVIDER = 4;
const RETIRING_SOON_MS = 30 * DAY;

// Anything that is not a general text chat model
const NON_CHAT = /(embed|whisper|tts|speech|audio|voxtral|transcri|guard|safety|moderation|content-safety|ocr|rerank|image|imagen|veo|lyria|vision-only|code|coder|codestral|devstral|leanstral|labs-|computer-use|robotics|live|native-audio|learnlm|aqa|playai|compound|allam|prompt-guard)/i;

const sizeOf = id => {
  const m = String(id).match(/(\d+(?:\.\d+)?)b(?![a-z])/i);
  return m ? Number(m[1]) : 0;
};
const versionOf = id => {
  const m = String(id).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
};
const notRetiring = date => !date || new Date(date).getTime() > Date.now() + RETIRING_SOON_MS;

async function getJson(url, headers = {}) {
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

const PROVIDERS = {
  groq: {
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keys: ['GROQ_API_KEY', 'GROK_API_KEY'],
    prefer: [/gpt-oss-1\d\db/, /llama-4-maverick|llama.*-70b|kimi-k2/, /qwen3?-?.*(235b|32b)|qwen3/, /llama-4/, /gpt-oss/],
    fallback: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'openai/gpt-oss-20b'],
    discover: async key => (await getJson('https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${key}` })).data
      .filter(m => m.active !== false && (m.context_window || 0) >= 8000)
      .map(m => ({ id: m.id, created: m.created })),
    extra: model => (/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : /qwen/.test(model) ? { reasoning_format: 'hidden' } : {}),
    reasoning: model => /gpt-oss|qwen/.test(model),
  },
  gemini: {
    label: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    // Google keeps these aliases pointed at the current generation
    pinned: ['gemini-flash-latest'],
    prefer: [/^gemini-\d+(\.\d+)?-flash$/, /^gemini-\d+(\.\d+)?-flash-lite$/, /^gemma/],
    tail: ['gemini-flash-lite-latest'],
    fallback: ['gemini-flash-latest', 'gemini-flash-lite-latest'],
    discover: async key => (await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': key })).models
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: String(m.name).replace(/^models\//, '') }))
      .filter(m => !/(preview|exp|tuning|-\d{3}$|thinking)/i.test(m.id)),
    extra: () => ({ reasoning_effort: 'low' }),
    reasoning: () => true,
  },
  mistral: {
    label: 'Mistral',
    url: process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions',
    // Mistral keeps per-role keys; the shared MISTRAL_API_KEY is the fallback
    keysForRole: {
      patient: ['MISTRAL_API_KEY_PATIENT', 'MISTRAL_API_KEY_USER'],
      user: ['MISTRAL_API_KEY_USER', 'MISTRAL_API_KEY_PATIENT'],
      hospital: ['MISTRAL_API_KEY_HOSPITAL'],
      admin: ['MISTRAL_API_KEY_ADMIN'],
    },
    keys: ['MISTRAL_API_KEY'],
    pinned: [process.env.MISTRAL_MODEL].filter(Boolean),
    prefer: [/^mistral-large-latest$/, /^mistral-medium-latest$/, /^mistral-small-latest$/, /^ministral-14b-latest$/, /^ministral-8b-latest$/, /^open-mistral-nemo$/],
    fallback: ['mistral-small-latest', 'ministral-14b-latest', 'open-mistral-nemo', 'ministral-8b-latest'],
    discover: async key => (await getJson(String(process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions').replace(/\/chat\/completions$/, '/models'), { Authorization: `Bearer ${key}` })).data
      .filter(m => m.capabilities?.completion_chat && notRetiring(m.deprecation))
      // Only the "-latest" style aliases: Mistral repoints them when a model is replaced
      .filter(m => /-latest$|^open-mistral-nemo$/.test(m.id))
      .map(m => ({ id: m.id, created: m.created })),
  },
  openrouter: {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keys: ['OPENROUTER_API_KEY'],
    prefer: [/:free$/],
    // OpenRouter's own router always forwards to some currently-live free model
    tail: ['openrouter/free'],
    fallback: ['openrouter/free'],
    discover: async () => (await getJson('https://openrouter.ai/api/v1/models')).data
      .filter(m => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
      .filter(m => /:free$/.test(m.id) && notRetiring(m.expiration_date))
      .filter(m => (m.context_length || 0) >= 32000 && (m.architecture?.output_modalities || ['text']).includes('text'))
      .filter(m => !/(preview|nano|lightning|-mini|small|xs|tiny)/i.test(m.id))
      // Prefer models that support structured output, then the biggest
      .map(m => ({ id: m.id, created: m.created, rank: (m.supported_parameters || []).includes('response_format') ? 0 : 1 })),
    headers: { 'HTTP-Referer': 'https://g1card.vercel.app', 'X-Title': 'G1Card' },
  },
  cerebras: {
    label: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    keys: ['CEREBRAS_API_KEY'],
    prefer: [/gpt-oss-1\d\db/, /glm|qwen.*235b|llama.*70b/],
    fallback: ['gpt-oss-120b'],
    discover: async key => (await getJson('https://api.cerebras.ai/v1/models', { Authorization: `Bearer ${key}` })).data
      .map(m => ({ id: m.id, created: m.created })),
    extra: model => (/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}),
    reasoning: model => /gpt-oss|glm|qwen/.test(model),
  },
};

const DEFAULT_ORDER = 'groq,gemini,mistral,openrouter,cerebras';
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || process.env.MISTRAL_TIMEOUT_MS) || 30000;
const REASONING_TOKEN_ALLOWANCE = 1500;
const PROBE_TIMEOUT_MS = 12000;

// Cooldowns per failure type (ms)
const COOLDOWN = {
  rateLimit: 60 * 1000,
  dailyQuota: 60 * 60 * 1000,
  auth: 60 * 60 * 1000,
  unknownModel: 6 * 60 * 60 * 1000,
  server: 30 * 1000,
  timeout: 2 * 60 * 1000,
};

const cooldowns = new Map(); // "provider/model" -> { until, reason }
const discovered = new Map(); // provider name -> { models, fetchedAt, source, promise }
let spreadCursor = 0;

/* ------------------------------------------------------------------------- */
/* Model discovery                                                            */
/* ------------------------------------------------------------------------- */

function envList(name) {
  return (process.env[name] || '').split(',').map(s => s.trim()).filter(Boolean);
}

function resolveKey(provider, role) {
  const names = [...(provider.keysForRole?.[role] || []), ...(provider.keys || [])];
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function rankModels(provider, models) {
  const preferIndex = id => {
    const i = (provider.prefer || []).findIndex(re => re.test(id));
    return i === -1 ? (provider.prefer || []).length : i;
  };
  return models
    .filter(m => m?.id && !NON_CHAT.test(m.id))
    .sort((a, b) =>
      preferIndex(a.id) - preferIndex(b.id)
      || (a.rank || 0) - (b.rank || 0)
      || sizeOf(b.id) - sizeOf(a.id)
      || versionOf(b.id) - versionOf(a.id)
      || (b.created || 0) - (a.created || 0))
    .map(m => m.id);
}

async function modelsFor(name, provider, key) {
  const pinnedByEnv = envList(`${name.toUpperCase()}_MODELS`);
  if (pinnedByEnv.length) return pinnedByEnv;

  let entry = discovered.get(name);
  const fresh = entry && Date.now() - entry.fetchedAt < DISCOVERY_TTL_MS;
  if (!fresh && !entry?.promise) {
    const promise = (async () => {
      try {
        const ranked = rankModels(provider, await provider.discover(key));
        if (!ranked.length) throw new Error('no usable models listed');
        const models = [...new Set([...(provider.pinned || []), ...ranked.slice(0, MODELS_PER_PROVIDER), ...(provider.tail || [])])];
        const previous = discovered.get(name)?.models?.join(',');
        if (previous !== models.join(',')) console.log(`[ai] ${provider.label} models: ${models.join(', ')}`);
        discovered.set(name, { models, fetchedAt: Date.now(), source: 'discovered' });
      } catch (err) {
        // Keep the last good list if we have one; otherwise use the built-in fallback
        const last = discovered.get(name);
        const models = last?.source === 'discovered' ? last.models : [...new Set([...(provider.pinned || []), ...provider.fallback])];
        if (!last?.models) console.warn(`[ai] ${provider.label} model discovery failed (${err.message}); using ${models.join(', ')}`);
        // Retry discovery sooner than the normal TTL
        discovered.set(name, { models, fetchedAt: Date.now() - DISCOVERY_TTL_MS + 30 * 60 * 1000, source: last?.source || 'fallback' });
      }
    })();
    discovered.set(name, { ...(entry || { models: null, fetchedAt: 0 }), promise });
    entry = discovered.get(name);
  }
  // First use: wait for discovery. Later refreshes happen in the background.
  if (!entry.models && entry.promise) await entry.promise;
  return discovered.get(name)?.models || [...new Set([...(provider.pinned || []), ...provider.fallback])];
}

function markStale(name) {
  const entry = discovered.get(name);
  if (entry && !entry.promise) entry.fetchedAt = 0;
}

async function candidatesFor(role) {
  const order = envList('AI_PROVIDER_ORDER');
  const names = (order.length ? order : DEFAULT_ORDER.split(',')).filter(name => PROVIDERS[name]);
  const groups = await Promise.all(names.map(async name => {
    const provider = PROVIDERS[name];
    const key = resolveKey(provider, role);
    if (!key) return [];
    const models = await modelsFor(name, provider, key);
    return models.map(model => ({ name, provider, model, key, id: `${name}/${model}` }));
  }));
  const list = groups.filter(g => g.length);
  if ((process.env.AI_ROUTING || 'priority').toLowerCase() === 'spread' && list.length > 1) {
    const start = spreadCursor++ % list.length;
    return [...list.slice(start), ...list.slice(0, start)].flat();
  }
  return list.flat();
}

/* ------------------------------------------------------------------------- */
/* Calls                                                                      */
/* ------------------------------------------------------------------------- */

function classifyFailure(status, message, retryAfterSeconds) {
  const text = String(message || '').toLowerCase();
  if (/api key|api_key|unauthori[sz]ed|invalid.*key/.test(text) && status >= 400 && status < 500) return { kind: 'invalid API key', ms: COOLDOWN.auth };
  if (status === 404 || (status === 400 && /decommission|deprecat|no longer (supported|available)|model.*(not found|does not exist|not exist|invalid)|invalid model|unknown model/.test(text))) {
    return { kind: 'model not found', ms: COOLDOWN.unknownModel };
  }
  if (status === 413 || /request too large|too many tokens|context length|maximum context/.test(text)) return { kind: 'request too large for this model', ms: 0 };
  if (status === 429) {
    if (/per day|daily|quota|exhausted|rpd|tpd|limit: 0/.test(text)) return { kind: 'daily quota reached', ms: COOLDOWN.dailyQuota };
    return { kind: 'rate limited', ms: retryAfterSeconds ? Math.min(retryAfterSeconds * 1000, COOLDOWN.dailyQuota) : COOLDOWN.rateLimit };
  }
  if (status === 401) return { kind: 'invalid API key', ms: COOLDOWN.auth };
  if (status === 402) return { kind: 'needs credits', ms: COOLDOWN.dailyQuota };
  if (status === 403) return { kind: /tier|subscription|not available|permission/.test(text) ? 'not available on this plan' : 'forbidden', ms: COOLDOWN.auth };
  if (status >= 500) return { kind: `server error ${status}`, ms: COOLDOWN.server };
  return null;
}

// Key/billing problems affect every model of a provider, so those cool the whole provider down.
const PROVIDER_WIDE = new Set(['invalid API key', 'needs credits']);

function coolDown(candidate, kind, ms, allCandidates = []) {
  const targets = PROVIDER_WIDE.has(kind)
    ? allCandidates.filter(c => c.name === candidate.name)
    : [candidate];
  const label = PROVIDER_WIDE.has(kind) ? `${candidate.provider.label} (all models)` : candidate.id;
  // Log once per cooldown period, not on every call
  const existing = cooldowns.get(candidate.id);
  if (!existing || existing.until < Date.now()) {
    console.warn(`[ai] ${label} ${kind}; skipping for ${Math.round(ms / 1000)}s`);
  }
  for (const target of targets.length ? targets : [candidate]) {
    cooldowns.set(target.id, { until: Date.now() + ms, reason: kind });
  }
}

function cleanContent(content) {
  const text = Array.isArray(content)
    ? content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('')
    : content;
  if (typeof text !== 'string') return '';
  // Some reasoning models inline their thinking
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function requestCompletion(candidate, { messages, temperature, maxTokens, jsonMode, minimal, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const { provider, model } = candidate;
  const useJson = jsonMode && provider.jsonMode !== false && !minimal;
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens + (provider.reasoning?.(model) ? REASONING_TOKEN_ALLOWANCE : 0),
    ...(useJson ? { response_format: { type: 'json_object' } } : {}),
    ...(!minimal && provider.extra ? provider.extra(model) : {}),
  };
  const resp = await fetch(provider.url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${candidate.key}`,
      ...(provider.headers || {}),
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  const errorMessage = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : '') || (Array.isArray(data) ? data[0]?.error?.message : '');
  return { resp, data, errorMessage };
}

/* ------------------------------------------------------------------------- */

export async function getAiReadiness() {
  const roles = ['patient', 'hospital', 'admin'];
  const byRole = {};
  for (const role of roles) {
    const candidates = await candidatesFor(role);
    byRole[role] = [...new Set(candidates.map(c => c.name))];
  }
  return {
    patient: byRole.patient.length > 0,
    user: byRole.patient.length > 0,
    hospital: byRole.hospital.length > 0,
    admin: byRole.admin.length > 0,
    providers: byRole,
    models: Object.fromEntries([...discovered.entries()].map(([name, e]) => [name, { models: e.models, source: e.source, refreshedAt: e.fetchedAt ? new Date(e.fetchedAt).toISOString() : null }])),
    routing: (process.env.AI_ROUTING || 'priority').toLowerCase(),
    coolingDown: [...cooldowns.entries()]
      .filter(([, v]) => v.until > Date.now())
      .map(([id, v]) => ({ id, reason: v.reason, secondsLeft: Math.round((v.until - Date.now()) / 1000) })),
  };
}

/**
 * Call the best available model for a role.
 * `prefer` ({ provider, model? }) puts that provider/model first — even if it is cooling down — and
 * the normal fallback order continues after it.
 * Returns { content, provider, providerLabel, model, preferredUsed }.
 */
export async function callModel({ role, messages, temperature = 0.1, maxTokens = 1800, jsonMode = false, prefer = null }) {
  const candidates = await candidatesFor(role);
  if (!candidates.length) {
    const roleKey = PROVIDERS.mistral.keysForRole[role]?.[0];
    throw new Error(`No AI provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY or ${roleKey || 'MISTRAL_API_KEY'} in Server/.env`);
  }

  const isPreferred = c => prefer?.provider && c.name === prefer.provider && (!prefer.model || c.model === prefer.model);
  const preferred = candidates.filter(isPreferred);
  if (prefer?.provider && prefer.model && !preferred.length) {
    // An explicitly chosen model that discovery did not list: still try it
    const provider = PROVIDERS[prefer.provider];
    const key = provider && resolveKey(provider, role);
    if (key) preferred.push({ name: prefer.provider, provider, model: prefer.model, key, id: `${prefer.provider}/${prefer.model}` });
  }

  const now = Date.now();
  const rest = candidates.filter(c => !isPreferred(c));
  const available = rest.filter(c => !(cooldowns.get(c.id)?.until > now));
  // Everything cooling down: try the soonest-to-recover candidates anyway rather than failing outright
  const fallbackQueue = available.length || preferred.length
    ? available
    : [...rest].sort((a, b) => cooldowns.get(a.id).until - cooldowns.get(b.id).until).slice(0, 3);
  const queue = [...preferred, ...fallbackQueue];

  const failures = [];
  for (const candidate of queue) {
    const chosen = preferred.includes(candidate);
    if (!chosen && cooldowns.get(candidate.id)?.until > Date.now() && available.length) continue; // cooled during this call
    try {
      let { resp, data, errorMessage } = await requestCompletion(candidate, { messages, temperature, maxTokens, jsonMode });

      // A 400 is usually an unsupported optional parameter (JSON mode, reasoning options): retry bare
      if (resp.status === 400) {
        ({ resp, data, errorMessage } = await requestCompletion(candidate, { messages, temperature, maxTokens, jsonMode, minimal: true }));
      }

      if (resp.ok) {
        const content = cleanContent(data?.choices?.[0]?.message?.content);
        if (content) {
          cooldowns.delete(candidate.id);
          return {
            content,
            provider: candidate.name,
            providerLabel: candidate.provider.label,
            // Routers (e.g. openrouter/free) report the model that actually answered
            model: data?.model && candidate.model.includes('/free') ? data.model : candidate.model,
            preferredUsed: prefer ? chosen : null,
          };
        }
        failures.push(`${candidate.id}: empty response`);
        coolDown(candidate, 'returned an empty response', COOLDOWN.server);
        continue;
      }

      const retryAfter = Number(resp.headers.get('retry-after')) || 0;
      const failure = classifyFailure(resp.status, errorMessage, retryAfter) || { kind: `HTTP ${resp.status}`, ms: COOLDOWN.server };
      failures.push(`${candidate.id}: ${errorMessage || failure.kind}`);
      if (failure.ms > 0) coolDown(candidate, failure.kind, failure.ms, candidates);
      if (failure.kind === 'model not found') markStale(candidate.name);
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const kind = timedOut ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : `network error (${err?.message || err})`;
      failures.push(`${candidate.id}: ${kind}`);
      coolDown(candidate, kind, timedOut ? COOLDOWN.timeout : COOLDOWN.server);
    }
  }

  throw new Error(`All AI providers failed. ${failures.join(' | ')}`);
}

export async function callRoleModel(options) {
  return (await callModel(options)).content;
}

/**
 * Providers and models available for a role, with live state. With probe=true each configured
 * provider is sent a tiny request (in parallel) to confirm it is answering right now.
 */
export async function listProviders({ role = 'admin', probe = false } = {}) {
  const names = (envList('AI_PROVIDER_ORDER').length ? envList('AI_PROVIDER_ORDER') : DEFAULT_ORDER.split(',')).filter(n => PROVIDERS[n]);
  const extra = Object.keys(PROVIDERS).filter(n => !names.includes(n));
  const now = Date.now();
  return Promise.all([...names, ...extra].map(async name => {
    const provider = PROVIDERS[name];
    const key = resolveKey(provider, role);
    if (!key) return { provider: name, label: provider.label, configured: false, models: [] };
    const models = (await modelsFor(name, provider, key)).map(model => {
      const cd = cooldowns.get(`${name}/${model}`);
      return cd?.until > now
        ? { id: model, status: 'cooling', reason: cd.reason, secondsLeft: Math.round((cd.until - now) / 1000) }
        : { id: model, status: 'available' };
    });
    const entry = { provider: name, label: provider.label, configured: true, inOrder: names.includes(name), models };
    if (probe) {
      const target = models.find(m => m.status === 'available') || models[0];
      const started = Date.now();
      try {
        const candidate = { name, provider, model: target.id, key, id: `${name}/${target.id}` };
        const { resp, data, errorMessage } = await requestCompletion(candidate, {
          messages: [{ role: 'user', content: 'Reply with OK' }], temperature: 0, maxTokens: 5, minimal: true, timeoutMs: PROBE_TIMEOUT_MS,
        });
        const ok = resp.ok && Boolean(cleanContent(data?.choices?.[0]?.message?.content) || data?.choices?.length);
        if (ok) cooldowns.delete(candidate.id);
        else {
          const failure = classifyFailure(resp.status, errorMessage, Number(resp.headers.get('retry-after')) || 0);
          if (failure?.ms) coolDown(candidate, failure.kind, failure.ms);
        }
        entry.probe = { ok, model: target.id, latencyMs: Date.now() - started, error: ok ? undefined : (errorMessage || `HTTP ${resp.status}`).slice(0, 160) };
      } catch (err) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        entry.probe = { ok: false, model: target.id, latencyMs: Date.now() - started, error: timedOut ? `No reply within ${PROBE_TIMEOUT_MS / 1000}s` : String(err?.message || err).slice(0, 160) };
      }
    }
    return entry;
  }));
}

const ROLE_TO_ENV_KEYS = {
  patient: ['MISTRAL_API_KEY_PATIENT', 'MISTRAL_API_KEY_USER', 'GROK_API_KEY_USER'],
  user: ['MISTRAL_API_KEY_USER', 'MISTRAL_API_KEY_PATIENT', 'GROK_API_KEY_USER'],
  hospital: ['MISTRAL_API_KEY_HOSPITAL', 'GROK_API_KEY_HOSPITAL'],
  admin: ['MISTRAL_API_KEY_ADMIN', 'GROK_API_KEY_ADMIN'],
};

const DEFAULT_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';
const DEFAULT_API_URL = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions';

function resolveApiKey(role) {
  const keyNames = ROLE_TO_ENV_KEYS[role] || [];
  for (const keyName of keyNames) {
    if (process.env[keyName]) {
      return { keyName, value: process.env[keyName] };
    }
  }
  return null;
}

export function getAiReadiness() {
  const patientReady = Boolean(resolveApiKey('patient'));
  return {
    patient: patientReady,
    user: patientReady,
    hospital: Boolean(resolveApiKey('hospital')),
    admin: Boolean(resolveApiKey('admin')),
    provider: 'mistral',
    model: DEFAULT_MODEL,
    apiUrlConfigured: Boolean(DEFAULT_API_URL),
  };
}

export async function callRoleModel({ role, messages, temperature = 0.1, maxTokens = 1800 }) {
  const keyNames = ROLE_TO_ENV_KEYS[role];
  if (!keyNames) {
    throw new Error(`Unsupported AI role: ${role}`);
  }

  const resolved = resolveApiKey(role);
  if (!resolved?.value) {
    throw new Error(`Missing ${keyNames.join(' or ')}. Configure in Server/.env`);
  }

  const resp = await fetch(DEFAULT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolved.value}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const details = data?.error?.message || data?.error || data?.message || `HTTP ${resp.status}`;
    throw new Error(`AI request failed: ${details}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AI response did not include message content');
  }

  return content;
}

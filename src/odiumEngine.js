export const MODE_DEFINITIONS = {
  basic: {
    id: 'basic',
    label: 'Basic',
    providerLabel: 'Gemini 3.6 Flash',
    thinkingLevel: 'Low',
    quotaCost: 0.25,
    description: 'Fast answers with very low quota usage.',
    available: true,
  },
  thinking: {
    id: 'thinking',
    label: 'Thinking',
    providerLabel: 'Gemini 3.6 Flash / Qwen',
    thinkingLevel: 'Medium',
    quotaCost: 2,
    description: 'Reasoning mode with adjustable thinking depth.',
    available: true,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra Thinking',
    providerLabel: 'GPT-5.6 Sol',
    thinkingLevel: 'High',
    quotaCost: 8,
    description: 'Maximum reasoning. Coming soon.',
    available: false,
  },
}

// Runtime targets for future provider adapters. These values are intentionally
// conservative so Basic stays fast and does not burn through a provider quota.
export const GEMINI_BASIC_PROFILE = {
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  thinkingLevel: 'low',
  includeThinkingSummaries: false,
  maxOutputTokens: 768,
  historyTurns: 6,
  retryLimit: 0,
}

export const GEMINI_THINKING_PROFILE = {
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  thinkingLevel: 'medium',
  includeThinkingSummaries: true,
  maxOutputTokens: 1536,
  historyTurns: 10,
  retryLimit: 0,
}

export const ODIUM_SYSTEM_IDENTITY = `You are Odium AI, the assistant inside the Odium product.
When the user asks what model you are, who you are, or which AI you are, identify yourself as Odium AI.
Do not volunteer the names of underlying providers or routed engines in ordinary conversation.
If a future product policy explicitly requires implementation transparency, describe Odium as a routed AI experience without exposing private credentials or account details.
Never fabricate hidden chain-of-thought. Only surface reasoning summaries that a provider explicitly exposes to the application.`

const USER_ID_KEY = 'odium.local-user-id'
const threadKey = (userId) => `odium.threads.${userId}`
const usageKey = (userId) => `odium.usage.${userId}`

const makeId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getLocalUserId() {
  let userId = localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = makeId()
    localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

export function loadThreads(userId) {
  try {
    return JSON.parse(localStorage.getItem(threadKey(userId)) || '[]')
  } catch {
    return []
  }
}

export function saveThreads(userId, threads) {
  localStorage.setItem(threadKey(userId), JSON.stringify(threads))
}

export function loadUsage(userId) {
  const fallback = { fiveHour: 100, weekly: 100 }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(usageKey(userId)) || '{}') }
  } catch {
    return fallback
  }
}

export function consumeUsage(userId, mode, thinkingDepth = 'medium') {
  const current = loadUsage(userId)
  let cost = MODE_DEFINITIONS[mode]?.quotaCost ?? 0.25
  if (mode === 'thinking' && thinkingDepth === 'high') cost = 4

  const weeklyCost = mode === 'basic' ? 0.1 : Math.max(0.5, cost / 2)
  const next = {
    fiveHour: Math.max(0, Number((current.fiveHour - cost).toFixed(2))),
    weekly: Math.max(0, Number((current.weekly - weeklyCost).toFixed(2))),
  }
  localStorage.setItem(usageKey(userId), JSON.stringify(next))
  return next
}

export function newThreadFromPrompt(prompt, mode, thinkingDepth) {
  const now = Date.now()
  return {
    id: makeId(),
    title: prompt.trim().slice(0, 42) || 'New chat',
    createdAt: now,
    updatedAt: now,
    mode,
    thinkingDepth,
    messages: [],
  }
}

export function isIdentityQuestion(input) {
  const text = input.toLocaleLowerCase('tr-TR').trim()
  return [
    /hangi model/, /hangi yapay zeka/, /hangi yapay zekâ/, /sen nesin/, /sen kimsin/,
    /what model/, /which model/, /who are you/, /what ai/, /which ai/,
  ].some((pattern) => pattern.test(text))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function buildPreviewAnswer(prompt) {
  if (isIdentityQuestion(prompt)) {
    return 'Ben Odium AI\'yım. Odium deneyimi içinde çalışan yapay zekâ asistanıyım.'
  }

  return `Mesajını aldım: “${prompt.trim()}”\n\nOdium'un sohbet, geçmiş, streaming ve thinking arayüzü şu anda çalışıyor. Basic için Gemini 3.6 Flash hedef profili hazır; gerçek sağlayıcı bağlantısı henüz preview motoruna takılmadığı için bu yanıt yerel test motorundan geliyor.`
}

export async function* streamOdiumResponse({ prompt, mode, thinkingDepth = 'medium' }) {
  const shouldThink = mode === 'thinking'

  yield { type: 'status', text: shouldThink ? 'Thinking' : 'Generating' }

  if (shouldThink) {
    const summaries = thinkingDepth === 'high'
      ? [
          'İsteğin kapsamını ve olası kısıtları değerlendiriyorum.',
          'Yanıtı daha tutarlı kılmak için alternatif yolları karşılaştırıyorum.',
          'Son cevabı kısa ve uygulanabilir bir yapıya getiriyorum.',
        ]
      : [
          'İsteğin ana amacını belirliyorum.',
          'Yanıtı uygulanabilir bir yapıya getiriyorum.',
        ]

    for (const summary of summaries) {
      await sleep(260)
      yield { type: 'reasoning', text: summary, visibility: 'provider-exposed-summary' }
    }
  }

  const answer = buildPreviewAnswer(prompt)
  const chunks = answer.split(/(\s+)/)
  for (const chunk of chunks) {
    await sleep(18)
    yield { type: 'answer', text: chunk }
  }

  yield { type: 'done' }
}

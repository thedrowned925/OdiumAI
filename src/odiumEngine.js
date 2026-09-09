import { isGeminiConfigured, streamGeminiResponse } from './providers/geminiProvider'

export const MODE_DEFINITIONS = {
  basic: {
    id: 'basic',
    label: 'Basic',
    providerLabel: 'Gemini 3.6 Flash',
    thinkingLevel: 'Low',
    description: 'Fast answers with low thinking.',
    available: true,
  },
  thinking: {
    id: 'thinking',
    label: 'Thinking',
    providerLabel: 'Provider pending',
    thinkingLevel: 'Medium',
    description: 'Reasoning mode. Coming soon.',
    available: false,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra Thinking',
    providerLabel: 'Provider pending',
    thinkingLevel: 'High',
    description: 'Maximum reasoning. Coming soon.',
    available: false,
  },
}

export const GEMINI_BASIC_PROFILE = {
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  thinkingLevel: 'low',
  includeThinkingSummaries: true,
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

export const GEMINI_36_FLASH_PRICING = {
  through2026: {
    effectiveUntil: '2026-12-31',
    inputPerMillionUsd: 0.75,
    outputPerMillionUsd: 3.75,
    cachedInputPerMillionUsd: 0.075,
  },
  from2027: {
    effectiveFrom: '2027-01-01',
    inputPerMillionUsd: 1.5,
    outputPerMillionUsd: 7.5,
    cachedInputPerMillionUsd: 0.15,
  },
}

export const DEFAULT_USAGE_ALLOWANCES_USD = {
  fiveHour: 0.05,
  weekly: 0.4,
}

const USER_ID_KEY = 'odium.local-user-id'
const threadKey = (userId) => `odium.threads.${userId}`
const usageLedgerKey = (userId) => `odium.usage-ledger.v2.${userId}`

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

function pricingForDate(at = new Date()) {
  const cutoff = new Date('2027-01-01T00:00:00Z')
  return at < cutoff ? GEMINI_36_FLASH_PRICING.through2026 : GEMINI_36_FLASH_PRICING.from2027
}

export function calculateGemini36FlashCost(usageMetadata = {}, at = new Date()) {
  const pricing = pricingForDate(at)
  const promptTokens = Math.max(0, Number(usageMetadata.promptTokenCount || 0))
  const cachedTokens = Math.min(promptTokens, Math.max(0, Number(usageMetadata.cachedContentTokenCount || 0)))
  const uncachedTokens = Math.max(0, promptTokens - cachedTokens)
  const outputTokens = Math.max(0, Number(usageMetadata.candidatesTokenCount || 0))
  const thinkingTokens = Math.max(0, Number(usageMetadata.thoughtsTokenCount || 0))

  const inputUsd = uncachedTokens * pricing.inputPerMillionUsd / 1_000_000
  const cachedInputUsd = cachedTokens * pricing.cachedInputPerMillionUsd / 1_000_000
  const outputUsd = (outputTokens + thinkingTokens) * pricing.outputPerMillionUsd / 1_000_000
  const totalUsd = inputUsd + cachedInputUsd + outputUsd

  return {
    totalUsd,
    inputUsd,
    cachedInputUsd,
    outputUsd,
    tokens: {
      prompt: promptTokens,
      cached: cachedTokens,
      uncached: uncachedTokens,
      output: outputTokens,
      thinking: thinkingTokens,
      total: promptTokens + outputTokens + thinkingTokens,
    },
    rates: pricing,
  }
}

function loadUsageEvents(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(usageLedgerKey(userId)) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveUsageEvents(userId, events) {
  localStorage.setItem(usageLedgerKey(userId), JSON.stringify(events.slice(-1000)))
}

export function recordProviderUsage(userId, { provider, model, usageMetadata, at = new Date() }) {
  if (provider !== 'gemini' || model !== 'gemini-3.6-flash') {
    throw new Error(`No pricing profile registered for ${provider}/${model}`)
  }

  const calculated = calculateGemini36FlashCost(usageMetadata, at)
  const event = {
    id: makeId(),
    timestamp: at.getTime(),
    provider,
    model,
    nominalCostUsd: calculated.totalUsd,
    usageMetadata: {
      promptTokenCount: calculated.tokens.prompt,
      cachedContentTokenCount: calculated.tokens.cached,
      candidatesTokenCount: calculated.tokens.output,
      thoughtsTokenCount: calculated.tokens.thinking,
    },
  }

  const events = [...loadUsageEvents(userId), event]
  saveUsageEvents(userId, events)
  return { event, usage: summarizeUsageEvents(events, at) }
}

function summarizeUsageEvents(events, now = new Date()) {
  const nowMs = now.getTime()
  const fiveHourStart = nowMs - 5 * 60 * 60 * 1000
  const weeklyStart = nowMs - 7 * 24 * 60 * 60 * 1000
  const sum = (since) => events
    .filter((event) => Number(event.timestamp) >= since)
    .reduce((total, event) => total + Number(event.nominalCostUsd || 0), 0)

  const fiveHourSpentUsd = sum(fiveHourStart)
  const weeklySpentUsd = sum(weeklyStart)
  const allTimeSpentUsd = events.reduce((total, event) => total + Number(event.nominalCostUsd || 0), 0)

  return {
    fiveHourSpentUsd,
    weeklySpentUsd,
    allTimeSpentUsd,
    fiveHourLimitUsd: DEFAULT_USAGE_ALLOWANCES_USD.fiveHour,
    weeklyLimitUsd: DEFAULT_USAGE_ALLOWANCES_USD.weekly,
    fiveHourLeftPercent: Math.max(0, Math.min(100, 100 * (1 - fiveHourSpentUsd / DEFAULT_USAGE_ALLOWANCES_USD.fiveHour))),
    weeklyLeftPercent: Math.max(0, Math.min(100, 100 * (1 - weeklySpentUsd / DEFAULT_USAGE_ALLOWANCES_USD.weekly))),
    lastCostUsd: events.length ? Number(events[events.length - 1].nominalCostUsd || 0) : 0,
    eventCount: events.length,
  }
}

export function loadUsage(userId) {
  return summarizeUsageEvents(loadUsageEvents(userId))
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

async function* streamText(text) {
  for (const chunk of text.split(/(\s+)/)) {
    await sleep(18)
    yield { type: 'answer', text: chunk }
  }
  yield { type: 'done' }
}

function buildPreviewAnswer(prompt) {
  return `Mesajını aldım: “${prompt.trim()}”\n\nOdium'un sohbet, geçmiş, streaming ve thinking arayüzü çalışıyor. Basic provider bağlantısı hazır olduğunda bu istek otomatik olarak Gemini rotasına geçecek. Bağlantı yokken preview motoru ücret veya kota tüketmez.`
}

export async function* streamOdiumResponse({ prompt, mode, thinkingDepth = 'medium', messages = [], signal }) {
  if (isIdentityQuestion(prompt)) {
    yield { type: 'status', text: 'Odium' }
    yield* streamText('Ben Odium AI\'yım. Odium deneyimi içinde çalışan yapay zekâ asistanıyım.')
    return
  }

  if (mode === 'basic' && isGeminiConfigured()) {
    let providerStarted = false
    try {
      yield { type: 'status', text: 'Gemini connected' }
      for await (const event of streamGeminiResponse({
        prompt,
        messages,
        thinkingDepth: 'low',
        signal,
      })) {
        if (event.type === 'answer' || event.type === 'reasoning') providerStarted = true
        yield event
      }
      return
    } catch (error) {
      if (providerStarted) throw error
      yield { type: 'status', text: 'Provider unavailable · Preview fallback' }
    }
  }

  const shouldThink = mode === 'thinking'
  yield { type: 'status', text: shouldThink ? 'Thinking preview' : 'Preview' }

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

  yield* streamText(buildPreviewAnswer(prompt))
}

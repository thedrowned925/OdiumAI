import { PROVIDERS, providerUrl } from './providerRegistry'

const GEMINI_PROVIDER = PROVIDERS.gemini

export function isGeminiConfigured() {
  return Boolean(providerUrl(GEMINI_PROVIDER.streamEndpoint))
}

function parseProviderEvent(raw) {
  if (!raw || typeof raw !== 'object') return null

  if (raw.type === 'answer' && typeof raw.text === 'string') {
    return { type: 'answer', text: raw.text }
  }

  if (raw.type === 'reasoning' && typeof raw.text === 'string') {
    return {
      type: 'reasoning',
      text: raw.text,
      visibility: 'provider-exposed-summary',
    }
  }

  if (raw.type === 'usage' && raw.usageMetadata) {
    return {
      type: 'usage',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      usageMetadata: raw.usageMetadata,
    }
  }

  if (raw.type === 'status' && typeof raw.text === 'string') {
    return { type: 'status', text: raw.text }
  }

  if (raw.type === 'done') return { type: 'done' }
  if (raw.type === 'error') throw new Error(raw.message || 'Gemini provider error')
  return null
}

function parseWireLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null

  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!payload || payload === '[DONE]') return payload === '[DONE]' ? { type: 'done' } : null

  return JSON.parse(payload)
}

export async function* streamGeminiResponse({ prompt, messages = [], thinkingDepth = 'low', signal }) {
  const url = providerUrl(GEMINI_PROVIDER.streamEndpoint)
  if (!url) throw new Error('Gemini backend is not configured')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/x-ndjson, application/json',
    },
    body: JSON.stringify({
      prompt,
      messages,
      mode: 'basic',
      thinkingDepth,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status})`)
  }

  if (!response.body) {
    const payload = await response.json()
    const event = parseProviderEvent(payload)
    if (event) yield event
    if (!event || event.type !== 'done') yield { type: 'done' }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      let raw
      try {
        raw = parseWireLine(line)
      } catch {
        continue
      }
      const event = parseProviderEvent(raw)
      if (!event) continue
      if (event.type === 'done') sawDone = true
      yield event
    }

    if (done) break
  }

  if (buffer.trim()) {
    try {
      const event = parseProviderEvent(parseWireLine(buffer))
      if (event) {
        if (event.type === 'done') sawDone = true
        yield event
      }
    } catch {
      // Ignore an incomplete trailing line.
    }
  }

  if (!sawDone) yield { type: 'done' }
}

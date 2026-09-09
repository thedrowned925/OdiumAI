import 'dotenv/config'
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.ODIUM_REQUESTS_PER_MINUTE || 20))
const MAX_BODY_BYTES = 1_000_000
const MAX_HISTORY_MESSAGES = 12
const MAX_TEXT_CHARS = 24_000
const DEFAULT_ORIGINS = 'http://localhost:5173,https://thedrowned925.github.io'
const ALLOWED_ORIGINS = new Set(
  (process.env.ODIUM_ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const SYSTEM_INSTRUCTION = `You are Odium AI, the assistant inside the Odium product.
When the user asks what model you are, who you are, or which AI you are, identify yourself as Odium AI.
Do not volunteer the names of underlying providers or routed engines in ordinary conversation.
Be concise, helpful, and safe. Never expose credentials, private routing data, or hidden chain-of-thought.`

const buckets = new Map()

function applyCors(req, res) {
  const origin = req.headers.origin
  if (!origin) return true

  if (ALLOWED_ORIGINS.has('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return true
  }

  if (!ALLOWED_ORIGINS.has(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  return true
}

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function withinRateLimit(req) {
  const now = Date.now()
  const key = clientIp(req)
  const current = buckets.get(key)

  if (!current || now - current.startedAt >= 60_000) {
    buckets.set(key, { startedAt: now, count: 1 })
    return true
  }

  if (current.count >= REQUESTS_PER_MINUTE) return false
  current.count += 1
  return true
}

async function readJson(req) {
  let total = 0
  const chunks = []

  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('Request body is too large')
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function sanitizeText(value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, MAX_TEXT_CHARS)
}

function buildContents(messages, prompt) {
  const turns = []
  const history = Array.isArray(messages) ? messages.slice(-MAX_HISTORY_MESSAGES) : []

  for (const message of history) {
    const text = sanitizeText(message?.content)
    if (!text) continue

    const role = message?.role === 'assistant' ? 'model' : 'user'
    const last = turns[turns.length - 1]

    if (last?.role === role) {
      last.parts[0].text += `\n\n${text}`
    } else {
      turns.push({ role, parts: [{ text }] })
    }
  }

  const promptText = sanitizeText(prompt)
  const last = turns[turns.length - 1]
  if (last?.role === 'user') last.parts[0].text += `\n\n${promptText}`
  else turns.push({ role: 'user', parts: [{ text: promptText }] })

  return turns
}

function geminiStreamUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`
}

function geminiModelUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}`
}

function parseGeminiEvent(payload) {
  if (!payload || typeof payload !== 'object') return { answer: [], reasoning: [], usage: null }

  const answer = []
  const reasoning = []
  const parts = payload.candidates?.[0]?.content?.parts || []

  for (const part of parts) {
    if (!part?.text) continue
    if (part.thought) reasoning.push(part.text)
    else answer.push(part.text)
  }

  return {
    answer,
    reasoning,
    usage: payload.usageMetadata || null,
  }
}

async function checkGemini(req, res) {
  if (!GEMINI_API_KEY) {
    writeJson(res, 503, {
      connected: false,
      model: MODEL,
      message: 'GEMINI_API_KEY is not configured on the Odium backend.',
    })
    return
  }

  try {
    const upstream = await fetch(geminiModelUrl(), {
      headers: { 'x-goog-api-key': GEMINI_API_KEY },
    })

    if (!upstream.ok) {
      writeJson(res, 502, {
        connected: false,
        model: MODEL,
        message: `Gemini rejected the backend credentials (${upstream.status}).`,
      })
      return
    }

    writeJson(res, 200, {
      connected: true,
      model: MODEL,
      message: `${MODEL} is ready through the Odium backend.`,
    })
  } catch {
    writeJson(res, 502, {
      connected: false,
      model: MODEL,
      message: 'Could not reach the Gemini API.',
    })
  }
}

async function streamGemini(req, res) {
  if (!GEMINI_API_KEY) {
    writeJson(res, 503, { error: 'GEMINI_API_KEY is not configured.' })
    return
  }

  if (!withinRateLimit(req)) {
    writeJson(res, 429, { error: 'Too many requests. Try again shortly.' })
    return
  }

  let body
  try {
    body = await readJson(req)
  } catch (error) {
    writeJson(res, 400, { error: error?.message || 'Invalid JSON body.' })
    return
  }

  const prompt = sanitizeText(body?.prompt)
  if (!prompt) {
    writeJson(res, 400, { error: 'Prompt is required.' })
    return
  }

  if (body?.mode && body.mode !== 'basic') {
    writeJson(res, 400, { error: 'Only Basic mode is enabled on this backend.' })
    return
  }

  const controller = new AbortController()
  res.on('close', () => controller.abort())

  let upstream
  try {
    upstream = await fetch(geminiStreamUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: buildContents(body?.messages, prompt),
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          maxOutputTokens: 768,
          thinkingConfig: {
            thinkingLevel: 'low',
            includeThoughts: true,
          },
        },
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') return
    writeJson(res, 502, { error: 'Could not reach the Gemini API.' })
    return
  }

  if (!upstream.ok || !upstream.body) {
    let message = `Gemini request failed (${upstream.status}).`
    try {
      const payload = await upstream.json()
      if (payload?.error?.message) message = payload.error.message
    } catch {
      // Keep the generic message.
    }
    writeJson(res, 502, { error: message })
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const emit = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  emit({ type: 'status', text: `${MODEL} connected` })

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latestUsage = null

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const raw = trimmed.slice(5).trim()
        if (!raw || raw === '[DONE]') continue

        let payload
        try {
          payload = JSON.parse(raw)
        } catch {
          continue
        }

        const parsed = parseGeminiEvent(payload)
        for (const text of parsed.reasoning) emit({ type: 'reasoning', text })
        for (const text of parsed.answer) emit({ type: 'answer', text })
        if (parsed.usage) latestUsage = parsed.usage
      }

      if (done) break
    }

    if (buffer.trim().startsWith('data:')) {
      const raw = buffer.trim().slice(5).trim()
      if (raw && raw !== '[DONE]') {
        try {
          const parsed = parseGeminiEvent(JSON.parse(raw))
          for (const text of parsed.reasoning) emit({ type: 'reasoning', text })
          for (const text of parsed.answer) emit({ type: 'answer', text })
          if (parsed.usage) latestUsage = parsed.usage
        } catch {
          // Ignore an incomplete trailing event.
        }
      }
    }

    if (latestUsage) {
      emit({
        type: 'usage',
        provider: 'gemini',
        model: MODEL,
        usageMetadata: latestUsage,
      })
    }
    emit({ type: 'done' })
    res.end()
  } catch (error) {
    if (error?.name !== 'AbortError') {
      emit({ type: 'error', message: 'Gemini stream ended unexpectedly.' })
      emit({ type: 'done' })
      res.end()
    }
  } finally {
    reader.releaseLock()
  }
}

const server = createServer(async (req, res) => {
  if (!applyCors(req, res)) {
    writeJson(res, 403, { error: 'Origin is not allowed.' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/api/providers/gemini/status') {
    await checkGemini(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/providers/gemini/stream') {
    await streamGemini(req, res)
    return
  }

  writeJson(res, 404, { error: 'Not found.' })
})

server.listen(PORT, () => {
  console.log(`Odium Gemini backend listening on http://localhost:${PORT}`)
  console.log(`Model: ${MODEL}`)
})

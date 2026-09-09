export const PROVIDER_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CHECKING: 'checking',
  ERROR: 'error',
}

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    model: 'Gemini 3.6 Flash',
    mode: 'Basic',
    description: 'Fast default provider for everyday requests.',
    statusEndpoint: '/api/providers/gemini/status',
    streamEndpoint: '/api/providers/gemini/stream',
  },
}

const API_BASE_STORAGE_KEY = 'odium.api-base-url'

export function getApiBaseUrl() {
  const stored = localStorage.getItem(API_BASE_STORAGE_KEY)
  if (stored) return stored.replace(/\/$/, '')
  return (import.meta.env.VITE_ODIUM_API_BASE_URL || '').replace(/\/$/, '')
}

export function setApiBaseUrl(value) {
  const normalized = value.trim().replace(/\/$/, '')
  if (normalized) localStorage.setItem(API_BASE_STORAGE_KEY, normalized)
  else localStorage.removeItem(API_BASE_STORAGE_KEY)
  return normalized
}

export function providerUrl(path) {
  const base = getApiBaseUrl()
  return base ? `${base}${path}` : ''
}

export async function checkProviderStatus(providerId, signal) {
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)

  const url = providerUrl(provider.statusEndpoint)
  if (!url) {
    return {
      status: PROVIDER_STATUS.DISCONNECTED,
      connected: false,
      message: 'Odium backend is not configured yet.',
    }
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      return {
        status: PROVIDER_STATUS.ERROR,
        connected: false,
        message: `Provider check failed (${response.status}).`,
      }
    }

    const payload = await response.json()
    return {
      status: payload.connected ? PROVIDER_STATUS.CONNECTED : PROVIDER_STATUS.DISCONNECTED,
      connected: Boolean(payload.connected),
      model: payload.model || provider.model,
      message: payload.message || (payload.connected ? 'Provider is ready.' : 'Provider is not connected.'),
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return {
      status: PROVIDER_STATUS.ERROR,
      connected: false,
      message: 'Could not reach the Odium backend.',
    }
  }
}

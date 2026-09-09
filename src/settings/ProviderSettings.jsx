import { useEffect, useState } from 'react'
import { Check, CircleAlert, LoaderCircle, Server, X } from 'lucide-react'
import {
  PROVIDERS,
  PROVIDER_STATUS,
  checkProviderStatus,
  getApiBaseUrl,
  setApiBaseUrl,
} from '../providers/providerRegistry'
import './provider-settings.css'

const GEMINI = PROVIDERS.gemini

function StatusBadge({ status }) {
  const copy = {
    [PROVIDER_STATUS.CONNECTED]: 'Connected',
    [PROVIDER_STATUS.DISCONNECTED]: 'Not connected',
    [PROVIDER_STATUS.CHECKING]: 'Checking',
    [PROVIDER_STATUS.ERROR]: 'Unavailable',
  }

  return <span className={`provider-status ${status}`}>{copy[status] || 'Unknown'}</span>
}

export default function ProviderSettings({ open, onClose }) {
  const [apiBaseUrl, setApiBaseUrlState] = useState(() => getApiBaseUrl())
  const [providerState, setProviderState] = useState({
    status: PROVIDER_STATUS.DISCONNECTED,
    connected: false,
    message: 'Odium backend is not configured yet.',
  })

  const runCheck = async () => {
    setProviderState((current) => ({ ...current, status: PROVIDER_STATUS.CHECKING }))
    const result = await checkProviderStatus('gemini')
    setProviderState(result)
  }

  useEffect(() => {
    if (!open) return
    setApiBaseUrlState(getApiBaseUrl())
    runCheck()
  }, [open])

  if (!open) return null

  const saveAndCheck = async () => {
    setApiBaseUrl(apiBaseUrl)
    await runCheck()
  }

  return (
    <div className="provider-settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="provider-settings" role="dialog" aria-modal="true" aria-label="Odium settings">
        <header className="provider-settings-header">
          <div>
            <p>Odium settings</p>
            <h2>Providers</h2>
          </div>
          <button className="provider-icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button>
        </header>

        <div className="provider-settings-body">
          <div className="provider-section-heading">
            <div>
              <h3>Model routing</h3>
              <p>Provider secrets stay on the Odium backend. This browser only knows the backend address.</p>
            </div>
          </div>

          <article className="provider-card">
            <div className="provider-card-top">
              <div className="provider-logo">G</div>
              <div className="provider-copy">
                <div className="provider-title-line">
                  <strong>{GEMINI.displayName}</strong>
                  <StatusBadge status={providerState.status} />
                </div>
                <span>{GEMINI.model} · Basic</span>
              </div>
            </div>

            <p className="provider-message">{providerState.message}</p>

            <div className="provider-route-row">
              <span>Route</span>
              <code>Basic → Gemini 3.6 Flash</code>
            </div>

            <div className="provider-route-row">
              <span>Fallback</span>
              <code>Preview engine</code>
            </div>
          </article>

          <div className="provider-field">
            <label htmlFor="odium-api-base">Odium backend URL</label>
            <div className="provider-input-wrap">
              <Server size={16} />
              <input
                id="odium-api-base"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrlState(event.target.value)}
                placeholder="https://api.example.com"
                inputMode="url"
                autoComplete="off"
              />
            </div>
            <small>No API key is stored here. The backend URL can be changed later without rebuilding the UI.</small>
          </div>

          <div className="provider-actions">
            <button className="provider-secondary" onClick={runCheck} disabled={providerState.status === PROVIDER_STATUS.CHECKING}>
              {providerState.status === PROVIDER_STATUS.CHECKING ? <LoaderCircle size={15} className="provider-spin" /> : <CircleAlert size={15} />}
              Check connection
            </button>
            <button className="provider-primary" onClick={saveAndCheck}>
              <Check size={15} />
              Save
            </button>
          </div>

          <div className="provider-note">
            <strong>Connection contract</strong>
            <p>The backend should expose <code>/api/providers/gemini/status</code> and <code>/api/providers/gemini/stream</code>. The stream may use SSE or newline-delimited JSON.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

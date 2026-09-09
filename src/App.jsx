import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  Menu,
  MoreHorizontal,
  Paperclip,
  Search,
  Settings2,
  SquarePen,
  X,
  Zap,
  Sparkles,
} from 'lucide-react'
import {
  MODE_DEFINITIONS,
  getLocalUserId,
  loadThreads,
  loadUsage,
  newThreadFromPrompt,
  recordProviderUsage,
  saveThreads,
  streamOdiumResponse,
} from './odiumEngine'

const MODE_ICONS = {
  basic: Zap,
  thinking: BrainCircuit,
  ultra: Sparkles,
}

const makeMessageId = (suffix) => `${Date.now()}-${suffix}-${Math.random().toString(16).slice(2)}`
const formatUsd = (value, digits = 4) => `$${Number(value || 0).toFixed(digits)}`

function Wordmark() {
  return (
    <div className="wordmark" aria-label="OdiumAI">
      <span className="wordmark-symbol">O</span>
      <span>Odium</span>
    </div>
  )
}

function UsageBar({ label, spent, limit, leftPercent }) {
  return (
    <div className="usage-item">
      <div className="usage-line">
        <span>{label}</span>
        <strong>{formatUsd(spent)} / {formatUsd(limit, 2)}</strong>
      </div>
      <div className="usage-bar"><span style={{ width: `${leftPercent}%` }} /></div>
    </div>
  )
}

function ModeMenu({ mode, depth, open, onToggle, onModeChange, onDepthChange }) {
  const current = MODE_DEFINITIONS[mode]
  const CurrentIcon = MODE_ICONS[mode]

  return (
    <div className="mode-wrap" onClick={(event) => event.stopPropagation()}>
      <button className="mode-button" onClick={onToggle} aria-expanded={open}>
        <CurrentIcon size={15} />
        <span>{current.label}</span>
        {mode === 'thinking' && <small>{depth === 'high' ? 'High' : 'Medium'}</small>}
        <ChevronDown size={14} className={open ? 'rotate' : ''} />
      </button>

      {open && (
        <div className="mode-menu">
          <div className="mode-menu-title">Mode</div>
          {Object.entries(MODE_DEFINITIONS).map(([key, item]) => {
            const Icon = MODE_ICONS[key]
            const selected = key === mode
            return (
              <button
                key={key}
                className={`mode-row ${selected ? 'selected' : ''} ${!item.available ? 'disabled' : ''}`}
                onClick={() => item.available && onModeChange(key)}
                disabled={!item.available}
              >
                <span className="mode-row-icon"><Icon size={16} /></span>
                <span className="mode-row-copy">
                  <span className="mode-row-title">
                    <strong>{item.label}</strong>
                    {!item.available && <em>Coming soon</em>}
                  </span>
                  <small>{item.description}</small>
                </span>
              </button>
            )
          })}

          {mode === 'thinking' && (
            <div className="thinking-depth">
              <div>
                <strong>Thinking depth</strong>
                <small>High may generate more thinking tokens.</small>
              </div>
              <div className="depth-control">
                <button className={depth === 'medium' ? 'active' : ''} onClick={() => onDepthChange('medium')}>Medium</button>
                <button className={depth === 'high' ? 'active' : ''} onClick={() => onDepthChange('high')}>High</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThinkingBlock({ message }) {
  if (!message.reasoning?.length && message.status !== 'thinking') return null

  return (
    <div className="thinking-block">
      <div className="thinking-heading">
        <BrainCircuit size={14} />
        <span>{message.status === 'thinking' ? 'Thinking' : 'Thinking summary'}</span>
        {message.status === 'thinking' && <span className="thinking-pulse" />}
      </div>
      {message.reasoning?.length > 0 && (
        <div className="thinking-lines">
          {message.reasoning.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        </div>
      )}
    </div>
  )
}

function UsageReceipt({ usage }) {
  if (!usage) return null
  const tokens = usage.tokens || {}
  return (
    <div className="message-usage">
      <span>{Number(tokens.prompt || 0).toLocaleString()} in</span>
      <span>{Number(tokens.output || 0).toLocaleString()} out</span>
      {Number(tokens.thinking || 0) > 0 && <span>{Number(tokens.thinking).toLocaleString()} thinking</span>}
      <strong>{formatUsd(usage.costUsd, 6)}</strong>
    </div>
  )
}

function Message({ message }) {
  if (message.role === 'user') {
    return <div className="message-row user"><div className="user-bubble">{message.content}</div></div>
  }

  return (
    <div className="message-row assistant">
      <div className="assistant-mark">O</div>
      <div className="assistant-body">
        <ThinkingBlock message={message} />
        {message.content && <div className="assistant-text">{message.content}</div>}
        {!message.content && message.status !== 'thinking' && <span className="response-cursor" />}
        <UsageReceipt usage={message.usage} />
      </div>
    </div>
  )
}

export default function App() {
  const [userId] = useState(() => getLocalUserId())
  const [threads, setThreads] = useState(() => loadThreads(getLocalUserId()))
  const [currentThreadId, setCurrentThreadId] = useState(() => loadThreads(getLocalUserId())[0]?.id ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860)
  const [mode, setMode] = useState('thinking')
  const [thinkingDepth, setThinkingDepth] = useState('medium')
  const [modeOpen, setModeOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [usage, setUsage] = useState(() => loadUsage(getLocalUserId()))
  const [isStreaming, setIsStreaming] = useState(false)
  const endRef = useRef(null)

  const currentThread = useMemo(
    () => threads.find((thread) => thread.id === currentThreadId) ?? null,
    [threads, currentThreadId],
  )
  const filteredThreads = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR')
    if (!query) return threads
    return threads.filter((thread) => thread.title.toLocaleLowerCase('tr-TR').includes(query))
  }, [threads, searchQuery])
  const currentMode = MODE_DEFINITIONS[mode]
  const CurrentModeIcon = MODE_ICONS[mode]

  useEffect(() => saveThreads(userId, threads), [threads, userId])
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [currentThread?.messages, isStreaming])

  const closeMenus = () => {
    if (modeOpen) setModeOpen(false)
  }

  const selectThread = (id) => {
    setCurrentThreadId(id)
    if (window.innerWidth <= 860) setSidebarOpen(false)
  }

  const startNewChat = () => {
    setCurrentThreadId(null)
    setPrompt('')
    if (window.innerWidth <= 860) setSidebarOpen(false)
  }

  const patchAssistant = (threadId, assistantId, patcher) => {
    setThreads((previous) => previous.map((thread) => {
      if (thread.id !== threadId) return thread
      return {
        ...thread,
        updatedAt: Date.now(),
        messages: thread.messages.map((message) => message.id === assistantId ? patcher(message) : message),
      }
    }))
  }

  const sendPrompt = async () => {
    const text = prompt.trim()
    if (!text || isStreaming || !currentMode.available) return

    const capturedMode = mode
    const capturedDepth = thinkingDepth
    const userMessage = { id: makeMessageId('user'), role: 'user', content: text, createdAt: Date.now() }
    const assistantId = makeMessageId('assistant')
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: [],
      status: capturedMode === 'thinking' ? 'thinking' : 'generating',
      mode: capturedMode,
      thinkingDepth: capturedDepth,
      createdAt: Date.now(),
    }

    let threadId = currentThreadId
    setPrompt('')
    setIsStreaming(true)

    if (!threadId) {
      const created = newThreadFromPrompt(text, capturedMode, capturedDepth)
      threadId = created.id
      created.messages = [userMessage, assistantMessage]
      setThreads((previous) => [created, ...previous])
      setCurrentThreadId(threadId)
    } else {
      setThreads((previous) => previous.map((thread) => thread.id === threadId
        ? { ...thread, updatedAt: Date.now(), messages: [...thread.messages, userMessage, assistantMessage] }
        : thread))
    }

    try {
      for await (const event of streamOdiumResponse({ prompt: text, mode: capturedMode, thinkingDepth: capturedDepth })) {
        if (event.type === 'reasoning') {
          patchAssistant(threadId, assistantId, (message) => ({
            ...message,
            status: 'thinking',
            reasoning: [...(message.reasoning || []), event.text],
          }))
        }
        if (event.type === 'answer') {
          patchAssistant(threadId, assistantId, (message) => ({
            ...message,
            status: 'generating',
            content: `${message.content}${event.text}`,
          }))
        }
        if (event.type === 'usage') {
          const recorded = recordProviderUsage(userId, {
            provider: event.provider,
            model: event.model,
            usageMetadata: event.usageMetadata,
          })
          setUsage(recorded.usage)
          patchAssistant(threadId, assistantId, (message) => ({
            ...message,
            usage: {
              costUsd: recorded.event.nominalCostUsd,
              tokens: {
                prompt: recorded.event.usageMetadata.promptTokenCount,
                output: recorded.event.usageMetadata.candidatesTokenCount,
                thinking: recorded.event.usageMetadata.thoughtsTokenCount,
                cached: recorded.event.usageMetadata.cachedContentTokenCount,
              },
            },
          }))
        }
        if (event.type === 'done') {
          patchAssistant(threadId, assistantId, (message) => ({ ...message, status: 'done' }))
        }
      }
    } catch {
      patchAssistant(threadId, assistantId, (message) => ({
        ...message,
        status: 'done',
        content: 'Bu isteği işlerken bir hata oluştu. Lütfen tekrar dene.',
      }))
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendPrompt()
    }
  }

  return (
    <div className="app-shell" onClick={closeMenus}>
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close sidebar"
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Wordmark />
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>

        <div className="sidebar-actions">
          <button className="new-chat" onClick={startNewChat}><SquarePen size={16} /><span>New chat</span></button>
          <button onClick={() => setSearchOpen((value) => !value)}><Search size={16} /><span>Search</span></button>
        </div>

        {searchOpen && (
          <div className="sidebar-search">
            <Search size={14} />
            <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search chats" />
          </div>
        )}

        <div className="sidebar-content">
          <div className="sidebar-label">Chats</div>
          <div className="conversation-list">
            {filteredThreads.length === 0 && <div className="empty-chats">No chats yet.</div>}
            {filteredThreads.map((thread) => (
              <button className={`conversation ${thread.id === currentThreadId ? 'active' : ''}`} key={thread.id} onClick={() => selectThread(thread.id)}>
                <span>{thread.title}</span>
                <small>{new Date(thread.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="usage-panel">
            <div className="usage-title">Nominal usage</div>
            <UsageBar label="5-hour" spent={usage.fiveHourSpentUsd} limit={usage.fiveHourLimitUsd} leftPercent={usage.fiveHourLeftPercent} />
            <UsageBar label="Weekly" spent={usage.weeklySpentUsd} limit={usage.weeklyLimitUsd} leftPercent={usage.weeklyLeftPercent} />
          </div>

          <button className="account-row">
            <span className="avatar">O</span>
            <span className="account-copy"><strong>Local profile</strong><small>Private on this device</small></span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={19} /></button>
            <Wordmark />
          </div>

          <div className="topbar-right">
            <ModeMenu
              mode={mode}
              depth={thinkingDepth}
              open={modeOpen}
              onToggle={() => setModeOpen((value) => !value)}
              onModeChange={(nextMode) => {
                setMode(nextMode)
                setModeOpen(false)
              }}
              onDepthChange={setThinkingDepth}
            />
            <button className="icon-button"><MoreHorizontal size={18} /></button>
          </div>
        </header>

        <section className={`workspace ${currentThread?.messages?.length ? 'has-chat' : ''}`}>
          {!currentThread?.messages?.length ? (
            <div className="welcome-wrap">
              <div className="welcome">
                <p className="welcome-kicker">Odium AI</p>
                <h1>How can I help?</h1>
                <p className="welcome-copy">A clean workspace for questions, ideas, files, and deeper reasoning.</p>
              </div>

              <div className="suggestions">
                <button onClick={() => setPrompt('Bana bugün üzerinde çalışabileceğim iyi bir proje fikri ver.')}><span>Start an idea</span><small>Brainstorm something useful</small></button>
                <button onClick={() => { setMode('thinking'); setPrompt('Bu problemi adım adım değerlendir ve en iyi yaklaşımı özetle: ') }}><span>Think through a problem</span><small>Use reasoning mode</small></button>
                <button onClick={() => setPrompt('Sen hangi modelsin?')}><span>Ask about Odium</span><small>Test product identity</small></button>
              </div>
            </div>
          ) : (
            <div className="messages" aria-live="polite">
              {currentThread.messages.map((message) => <Message message={message} key={message.id} />)}
              <div ref={endRef} />
            </div>
          )}

          <div className="composer-area">
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Odium"
                rows={1}
                disabled={isStreaming}
              />

              <div className="composer-bottom">
                <div className="composer-tools">
                  <button className="composer-icon" aria-label="Attach file"><Paperclip size={18} /></button>
                  <span className="preview-label">Preview · no provider charge</span>
                </div>

                <div className="composer-actions">
                  <span className="composer-mode"><CurrentModeIcon size={13} />{currentMode.label}{mode === 'thinking' ? ` · ${thinkingDepth === 'high' ? 'High' : 'Medium'}` : ''}</span>
                  <button className={`send-button ${prompt.trim() && !isStreaming ? 'ready' : ''}`} onClick={sendPrompt} disabled={!prompt.trim() || isStreaming || !currentMode.available} aria-label="Send message">
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="composer-note">Usage is metered from provider-reported input, output and thinking tokens. Preview requests do not consume quota.</div>
          </div>
        </section>
      </main>
    </div>
  )
}

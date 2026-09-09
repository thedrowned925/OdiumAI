import { useMemo, useState } from 'react'
import {
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  FileText,
  History,
  Image,
  Menu,
  MoreHorizontal,
  Paperclip,
  Search,
  Settings2,
  Sparkles,
  SquarePen,
  X,
  Zap,
} from 'lucide-react'

const MODES = {
  basic: {
    label: 'Basic',
    description: 'Fast, lightweight responses',
    usage: 'Low usage',
    icon: Zap,
  },
  thinking: {
    label: 'Thinking',
    description: 'Balanced reasoning for harder work',
    usage: 'Medium usage',
    icon: BrainCircuit,
  },
  ultra: {
    label: 'Ultra Thinking',
    description: 'Maximum reasoning for complex tasks',
    usage: 'High usage',
    icon: Sparkles,
  },
}

const conversations = [
  { title: 'Design a launch strategy', time: '2m' },
  { title: 'Refactor desktop agent flow', time: '1h' },
  { title: 'Compare reasoning modes', time: '3h' },
  { title: 'Landing page copy', time: 'Yesterday' },
]

function Wordmark() {
  return (
    <div className="wordmark" aria-label="OdiumAI">
      <span className="wordmark-symbol">O</span>
      <span>Odium</span>
    </div>
  )
}

function UsageBar({ label, value, detail }) {
  return (
    <div className="usage-item">
      <div className="usage-line">
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
      <div className="usage-bar"><span style={{ width: `${value}%` }} /></div>
    </div>
  )
}

function ModeMenu({ mode, open, onToggle, onChange }) {
  const current = MODES[mode]
  const CurrentIcon = current.icon

  return (
    <div className="mode-wrap" onClick={(event) => event.stopPropagation()}>
      <button className="mode-button" onClick={onToggle} aria-expanded={open}>
        <CurrentIcon size={15} />
        <span>{current.label}</span>
        <ChevronDown size={14} className={open ? 'rotate' : ''} />
      </button>

      {open && (
        <div className="mode-menu">
          <div className="mode-menu-title">Model mode</div>
          {Object.entries(MODES).map(([key, item]) => {
            const Icon = item.icon
            const selected = key === mode
            return (
              <button
                key={key}
                className={`mode-row ${selected ? 'selected' : ''}`}
                onClick={() => onChange(key)}
              >
                <span className="mode-row-icon"><Icon size={16} /></span>
                <span className="mode-row-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="mode-row-usage">{item.usage}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860)
  const [mode, setMode] = useState('thinking')
  const [modeOpen, setModeOpen] = useState(false)
  const [prompt, setPrompt] = useState('')

  const currentMode = useMemo(() => MODES[mode], [mode])
  const CurrentModeIcon = currentMode.icon

  const closeMenus = () => {
    if (modeOpen) setModeOpen(false)
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
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="new-chat"><SquarePen size={16} /><span>New chat</span></button>
          <button><Search size={16} /><span>Search</span></button>
          <button><History size={16} /><span>Library</span></button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-label">Recent</div>
          <div className="conversation-list">
            {conversations.map((item, index) => (
              <button className={`conversation ${index === 0 ? 'active' : ''}`} key={item.title}>
                <span>{item.title}</span>
                <small>{item.time}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="usage-panel">
            <div className="usage-title">Usage</div>
            <UsageBar label="5-hour" value={42} detail="58% left" />
            <UsageBar label="Weekly" value={68} detail="32% left" />
          </div>

          <button className="account-row">
            <span className="avatar">H</span>
            <span className="account-copy"><strong>Hasan</strong><small>Odium Plus</small></span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={19} />
            </button>
            <Wordmark />
          </div>

          <div className="topbar-right">
            <ModeMenu
              mode={mode}
              open={modeOpen}
              onToggle={() => setModeOpen((value) => !value)}
              onChange={(nextMode) => {
                setMode(nextMode)
                setModeOpen(false)
              }}
            />
            <button className="icon-button"><MoreHorizontal size={18} /></button>
          </div>
        </header>

        <section className="workspace">
          <div className="welcome">
            <p className="welcome-kicker">OdiumAI</p>
            <h1>How can I help?</h1>
            <p className="welcome-copy">Ask a question, work through an idea, or attach something you want to analyze.</p>
          </div>

          <div className="suggestions">
            <button><FileText size={15} /><span>Analyze a document</span></button>
            <button><BrainCircuit size={15} /><span>Work through a difficult problem</span></button>
            <button><Image size={15} /><span>Explore a visual idea</span></button>
          </div>

          <div className="composer-area">
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Message Odium"
                rows={1}
              />

              <div className="composer-bottom">
                <div className="composer-tools">
                  <button className="composer-icon" aria-label="Attach file"><Paperclip size={18} /></button>
                  <button className="tools-button"><span>Tools</span><ChevronDown size={13} /></button>
                </div>

                <div className="composer-actions">
                  <span className="composer-mode"><CurrentModeIcon size={13} />{currentMode.label}</span>
                  <button className={`send-button ${prompt.trim() ? 'ready' : ''}`} aria-label="Send message">
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="composer-note">Odium can make mistakes. Check important information.</div>
          </div>
        </section>
      </main>
    </div>
  )
}

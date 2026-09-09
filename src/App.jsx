import { useMemo, useState } from 'react'
import {
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  Clock3,
  Command,
  FileText,
  Gauge,
  History,
  Image,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Search,
  Settings2,
  Sparkles,
  SquarePen,
  Zap,
} from 'lucide-react'

const MODES = {
  basic: {
    label: 'Basic',
    subtitle: 'Fast answers for everyday work',
    icon: Zap,
    cost: 'Lowest usage',
    accent: 'basic',
  },
  thinking: {
    label: 'Thinking',
    subtitle: 'Balanced reasoning for harder tasks',
    icon: BrainCircuit,
    cost: 'Medium usage',
    accent: 'thinking',
  },
  ultra: {
    label: 'Ultra Thinking',
    subtitle: 'Maximum reasoning for complex work',
    icon: Sparkles,
    cost: 'High usage',
    accent: 'ultra',
  },
}

const conversations = [
  { title: 'Design a launch strategy', time: '2m' },
  { title: 'Refactor desktop agent flow', time: '1h' },
  { title: 'Compare reasoning modes', time: '3h' },
  { title: 'Landing page copy', time: 'Yesterday' },
]

function OdiumMark() {
  return (
    <div className="odium-mark" aria-hidden="true">
      <span className="odium-mark-core" />
    </div>
  )
}

function ModeMenu({ mode, onChange, open, setOpen }) {
  const current = MODES[mode]
  const CurrentIcon = current.icon

  return (
    <div className="mode-picker-wrap">
      <button className="mode-picker" onClick={() => setOpen(!open)}>
        <span className={`mode-icon ${current.accent}`}><CurrentIcon size={15} /></span>
        <span className="mode-picker-copy">
          <strong>OdiumAI</strong>
          <span>{current.label}</span>
        </span>
        <ChevronDown size={15} className={open ? 'rotate' : ''} />
      </button>

      {open && (
        <div className="mode-menu">
          <div className="mode-menu-heading">
            <span>Reasoning mode</span>
            <span className="kbd"><Command size={11} /> M</span>
          </div>
          {Object.entries(MODES).map(([key, item]) => {
            const Icon = item.icon
            return (
              <button
                key={key}
                className={`mode-option ${mode === key ? 'selected' : ''}`}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
              >
                <span className={`mode-option-icon ${item.accent}`}><Icon size={17} /></span>
                <span className="mode-option-copy">
                  <span className="mode-option-row">
                    <strong>{item.label}</strong>
                    {key === 'basic' && <em>Default</em>}
                  </span>
                  <small>{item.subtitle}</small>
                  <span className="mode-cost">{item.cost}</span>
                </span>
                <span className={`radio ${mode === key ? 'checked' : ''}`} />
              </button>
            )
          })}
          <div className="mode-menu-footer">Higher reasoning modes consume your 5-hour and weekly allowance faster.</div>
        </div>
      )}
    </div>
  )
}

function UsageMeter({ label, value, detail }) {
  return (
    <div className="usage-row">
      <div className="usage-copy">
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
      <div className="usage-track"><span style={{ width: `${value}%` }} /></div>
    </div>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mode, setMode] = useState('thinking')
  const [modeOpen, setModeOpen] = useState(false)
  const [prompt, setPrompt] = useState('')

  const currentMode = useMemo(() => MODES[mode], [mode])

  return (
    <div className="app-shell" onClick={() => modeOpen && setModeOpen(false)}>
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="brand-row">
            <div className="brand-lockup">
              <OdiumMark />
              <span>odium</span>
            </div>
            <button className="icon-button quiet sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar">
              <Menu size={18} />
            </button>
          </div>

          <button className="new-chat-button">
            <SquarePen size={16} />
            <span>New chat</span>
            <span className="shortcut">⌘ N</span>
          </button>

          <button className="sidebar-action"><Search size={16} /><span>Search</span></button>
          <button className="sidebar-action"><History size={16} /><span>Library</span></button>
        </div>

        <div className="sidebar-scroll">
          <div className="section-label">Recent</div>
          <div className="conversation-list">
            {conversations.map((item, index) => (
              <button className={`conversation ${index === 0 ? 'active' : ''}`} key={item.title}>
                <span className="conversation-title">{item.title}</span>
                <span className="conversation-time">{item.time}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="usage-card">
            <div className="usage-card-title">
              <span><Gauge size={14} /> Usage</span>
              <button><MoreHorizontal size={15} /></button>
            </div>
            <UsageMeter label="5-hour window" value={42} detail="58% left" />
            <UsageMeter label="Weekly" value={68} detail="32% left" />
          </div>

          <button className="profile-row">
            <span className="avatar">H</span>
            <span className="profile-copy"><strong>Hasan</strong><small>Odium Plus</small></span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={18} /></button>
            )}
            <div onClick={(event) => event.stopPropagation()}>
              <ModeMenu mode={mode} onChange={setMode} open={modeOpen} setOpen={setModeOpen} />
            </div>
          </div>
          <div className="topbar-right">
            <span className="status-pill"><span /> Private session</span>
            <button className="icon-button"><MoreHorizontal size={18} /></button>
          </div>
        </header>

        <section className="workspace">
          <div className="hero">
            <div className="hero-mark"><OdiumMark /></div>
            <div className="eyebrow">Odium Intelligence</div>
            <h1>What are we building?</h1>
            <p>Think, create, analyze, and ship without breaking your flow.</p>
          </div>

          <div className="quick-actions">
            <button><span><FileText size={16} /></span><div><strong>Analyze files</strong><small>Read, summarize, compare</small></div></button>
            <button><span><BrainCircuit size={16} /></span><div><strong>Deep reasoning</strong><small>Plan a complex task</small></div></button>
            <button><span><Image size={16} /></span><div><strong>Visual work</strong><small>Explore an image idea</small></div></button>
          </div>

          <div className="composer-wrap">
            <div className="composer-glow" />
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask Odium anything..."
                rows={1}
              />
              <div className="composer-toolbar">
                <div className="composer-left">
                  <button className="tool-button"><Paperclip size={17} /></button>
                  <button className="tool-chip"><Sparkles size={14} /> Tools <ChevronDown size={13} /></button>
                </div>
                <div className="composer-right">
                  <span className={`active-mode-label ${currentMode.accent}`}>
                    <currentMode.icon size={13} /> {currentMode.label}
                  </span>
                  <button className={`send-button ${prompt.trim() ? 'ready' : ''}`} aria-label="Send message">
                    <ArrowUp size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
            <div className="composer-meta">
              <span><Clock3 size={12} /> 5-hour allowance resets in 3h 12m</span>
              <span>Odium can make mistakes. Check important information.</span>
            </div>
          </div>
        </section>

        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
      </main>
    </div>
  )
}

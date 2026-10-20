import { useEffect, useRef, useState } from 'react'
import { DOCS_URL, INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { Intro, Skills, Footer } from './sections.jsx'
import './home.css'

// 贴纸位置固定：x / y 是相对字标区域的百分比位置，r 是旋转角度。最后一个是毛玻璃款
const SLOTS = [
  { x: 3, y: 6, r: -9 },
  { x: 70, y: 2, r: 7 },
  { x: 72, y: 66, r: -6 },
  { x: 8, y: 70, r: 5 },
  { x: 44, y: -4, r: -3, glass: true },
]

// 浅色贴纸底色，在淡紫首屏上都能看清
const COLORS = ['#fff1a8', '#ffd3ec', '#c9f2e1', '#ffd9c2', '#e4dbff', '#d3e4ff']

// 贴纸内容池，每次加载随机抽几张；name 保持短，避免右侧贴纸出界
const POOL = [
  { event: 'tool.pre', name: 'no-force-push', icon: '⛨' },
  { event: 'tool.pre', name: 'no-rm-rf', icon: '⚑' },
  { event: 'tool.pre', name: 'no-secrets', icon: '☂' },
  { event: 'tool.post', name: 'no-todo', icon: '✓' },
  { event: 'tool.post', name: 'run-tests', icon: '♺' },
  { event: 'tool.post', name: 'lint-nudge', icon: '⚙' },
  { event: 'system', name: 'terse', icon: '✂' },
  { event: 'system', name: 'zh-answers', icon: '文' },
  { event: 'system', name: 'plain-words', icon: '✿' },
  { event: 'skill', name: 'code-review', icon: '✎' },
  { event: 'skill', name: 'release', icon: '★' },
  { event: 'mcp', name: 'pr-checklist', icon: '⌥' },
  { event: 'mcp', name: 'ticket-link', icon: '✉' },
  { event: 'session.start', name: 'repo-context', icon: '◎' },
  { event: 'prompt.submitted', name: 'ask-first', icon: '⏎' },
  { event: 'subagent.start', name: 'share-notes', icon: '✱' },
  { event: 'harness', name: 'claude-code', icon: '⌘' },
  { event: 'harness', name: 'codex', icon: '⌘' },
  { event: 'style/v0.3', name: 'M1 preview', icon: '✦' },
  { event: 'action', name: 'block', icon: '⊘' },
]

const LAST_KEY = 'style-stickers-last'

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 避开上一次出现过的贴纸，保证每次刷新都是新的一批
function pickStickers() {
  let last = []
  try { last = JSON.parse(localStorage.getItem(LAST_KEY)) || [] } catch { /* 存储不可用时直接随机 */ }
  const picked = shuffle(POOL.filter((s) => !last.includes(s.name))).slice(0, SLOTS.length)
  try { localStorage.setItem(LAST_KEY, JSON.stringify(picked.map((s) => s.name))) } catch { /* 忽略 */ }
  const colors = shuffle(COLORS)
  return SLOTS.map((slot, i) => ({ ...picked[i], ...slot, id: picked[i].name, bg: slot.glass ? undefined : colors[i] }))
}

// 模块加载时抽一次，避免 StrictMode 下重复抽取
const INITIAL = pickStickers()

function Stickers() {
  const [items, setItems] = useState(INITIAL)
  const [top, setTop] = useState(null)
  const drag = useRef(null)
  const stage = useRef(null)

  const onDown = (e, id) => {
    const rect = stage.current.getBoundingClientRect()
    const item = items.find((s) => s.id === id)
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, w: rect.width, h: rect.height }
    e.currentTarget.setPointerCapture(e.pointerId)
    setTop(id)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const x = d.ox + ((e.clientX - d.sx) / d.w) * 100
    const y = d.oy + ((e.clientY - d.sy) / d.h) * 100
    setItems((list) => list.map((s) => (s.id === d.id ? { ...s, x, y } : s)))
  }
  const onUp = () => { drag.current = null }

  return (
    <div className="sk-stickers" ref={stage}>
      {items.map((s) => (
        <div
          key={s.id}
          className={`sk-sticker ${s.glass ? 'is-glass' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, '--r': `${s.r}deg`, background: s.bg, zIndex: s.id === top ? 2 : 1 }}
          onPointerDown={(e) => onDown(e, s.id)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="sk-sticker-icon">{s.icon}</span>
          <span className="sk-sticker-text">
            <small>{s.event}</small>
            <b>{s.name}</b>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [copied, copy] = useCopy()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 滚动进入视口时淡入
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      }),
      { threshold: 0.15 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div className={`sk-header-wrap ${scrolled ? 'is-scrolled' : ''}`}>
        <header className="sk-header">
          <div className="sk-head-left">
            <a className="sk-logo" href="#top"><span className="sk-logo-mark"><LogoIcon /></span>STYLE</a>
            <ThemeToggle />
          </div>
          <nav className="sk-nav">
            <a className="sk-nav-gh" href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </header>
      </div>

      <section className="sk" id="top">
        <span className="sk-ring sk-ring-1" aria-hidden="true" />
        <span className="sk-ring sk-ring-2" aria-hidden="true" />

        <main className="sk-main">
          <div className="sk-stage">
            <div className="sk-stage-inner">
              <h1 className="sk-word">STYLE</h1>
              <span className="sk-orb sk-orb-1" aria-hidden="true" />
              <span className="sk-orb sk-orb-2" aria-hidden="true" />
              <Stickers />
            </div>
          </div>

          <div className="sk-bottom">
            <div className="sk-copy">
              <p className="sk-sub">你的 Agent，<br />也该有你的 STYLE。</p>
              <span className="sk-hint">↖ 贴纸可以拖动</span>
            </div>
            <div className="sk-actions">
              <div className="sk-cmd">
                <code><span>$</span>{INSTALL_CMD}</code>
                <button onClick={() => copy()} aria-label="复制命令">{copied ? '✓' : '复制'}</button>
              </div>
              <a className="sk-btn" href={DOCS_URL}>打开文档 →</a>
            </div>
          </div>
        </main>
      </section>

      <Intro />
      <Skills />
      <Footer />
    </>
  )
}

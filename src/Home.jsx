import { useEffect, useRef, useState } from 'react'
import { DOCS_URL, INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import { Intro, Footer } from './sections.jsx'
import './home.css'

// x / y 是相对字标区域的百分比位置，r 是旋转角度
const INITIAL = [
  { id: 'block', event: 'tool.pre', name: 'no-force-push', icon: '⛨', bg: '#ffe14a', x: 3, y: 6, r: -9 },
  { id: 'skill', event: 'skill', name: 'code-review', icon: '✎', bg: '#ff9ade', x: 74, y: 2, r: 7 },
  { id: 'warn', event: 'tool.post', name: 'no-todo', icon: '✓', bg: '#86f7cb', x: 80, y: 66, r: -6 },
  { id: 'system', event: 'system', name: 'terse', icon: '✂', bg: '#ff7a45', x: 8, y: 70, r: 5 },
  { id: 'ver', event: 'style/v0.3', name: 'M1 preview', icon: '✦', glass: true, x: 44, y: -4, r: -3 },
]

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
          <a className="sk-logo" href="#top"><span className="sk-logo-mark"><LogoIcon /></span>STYLE</a>
          <nav className="sk-nav">
            <a href={DOCS_URL}>文档</a>
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
              <a className="sk-btn" href="#start">开始使用 →</a>
            </div>
          </div>
        </main>
      </section>

      <Intro />
      <Footer />
    </>
  )
}

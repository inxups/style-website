import { Fragment, useEffect, useRef, useState } from 'react'
import { REPO_URL } from './shared.js'
import { PAGES, resolveHref } from './docs-content.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './home.css'
import './sections.css'
import './docs.css'

const HOME = import.meta.env.BASE_URL

// 每个 md 页面是一组，组内是字段或小节
const TOC = PAGES.map((p) => ({ id: p.slug, group: p.short, items: p.toc }))

const LANG = { yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash', shell: 'bash', console: 'bash', json: 'json', md: 'md', markdown: 'md' }

const text = (tokens) => tokens.map((t) => (t.tokens ? text(t.tokens) : t.text)).join('').trim()

/* ---------- 行内 ---------- */

function Inline({ tokens }) {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'codespan': return <code key={i}>{t.text}</code>
      case 'strong': return <b key={i}><Inline tokens={t.tokens} /></b>
      case 'em': return <em key={i}><Inline tokens={t.tokens} /></em>
      case 'del': return <del key={i}><Inline tokens={t.tokens} /></del>
      case 'br': return <br key={i} />
      case 'link': {
        const href = resolveHref(t.href)
        const ext = /^https?:/.test(href)
        // 正文里写成 [xxx.md](xxx.md) 的链接，页面上只显示 xxx
        const label = href !== t.href && /^[\w-]+\.md$/.test(t.text) ? t.text.slice(0, -3) : <Inline tokens={t.tokens} />
        return (
          <a key={i} href={href} {...(ext && { target: '_blank', rel: 'noreferrer' })}>
            {label}{ext && ' ↗'}
          </a>
        )
      }
      case 'text': return t.tokens ? <Fragment key={i}><Inline tokens={t.tokens} /></Fragment> : t.text
      default: return t.text ?? ''
    }
  })
}

/* ---------- 块 ---------- */

function Table({ token }) {
  return (
    <div className={`doc-table ${token.header.length > 3 ? 'is-wrap' : ''}`}>
      <table>
        <thead>
          <tr>{token.header.map((h, i) => <th key={i}><Inline tokens={h.tokens} /></th>)}</tr>
        </thead>
        <tbody>
          {token.rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}><Inline tokens={cell.tokens} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function List({ token }) {
  const Tag = token.ordered ? 'ol' : 'ul'
  return (
    <Tag className={token.ordered ? 'doc-olist' : 'doc-list'} start={token.ordered && token.start !== 1 ? token.start : undefined}>
      {token.items.map((item, i) => <li key={i}>{blocks(item.tokens, { tight: !item.loose })}</li>)}
    </Tag>
  )
}

// 「相关」小节的链接列表渲染成标签
function Related({ token }) {
  const links = token.items.map((item) => item.tokens[0]?.tokens?.find((t) => t.type === 'link')).filter(Boolean)
  if (links.length !== token.items.length) return <List token={token} />
  return (
    <nav className="field-index doc-related">
      {links.map((l, i) => <a key={i} href={resolveHref(l.href)}><Inline tokens={l.tokens} /></a>)}
    </nav>
  )
}

// 代码块前一段只有「`文件名`：」时，把它当作代码块标题
const codeTitle = (t, next) => next?.type === 'code' && t.tokens.length <= 2 && t.tokens[0]?.type === 'codespan'
  && /^`[^`]+`[：:]\s*$/.test(t.raw.trim()) ? t.tokens[0].text : null

function blocks(tokens, ctx = {}) {
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const key = i
    switch (t.type) {
      case 'paragraph': {
        const title = codeTitle(t, tokens[i + 1])
        if (title) {
          ctx.title = title
          break
        }
        out.push(<p key={key}><Inline tokens={t.tokens} /></p>)
        break
      }
      case 'text':
        out.push(ctx.tight
          ? <Fragment key={key}><Inline tokens={t.tokens ?? [t]} /></Fragment>
          : <p key={key}><Inline tokens={t.tokens ?? [t]} /></p>)
        break
      case 'code': {
        const lang = LANG[t.lang] ?? 'text'
        out.push(<Code key={key} lang={lang} title={ctx.title} copy={lang === 'bash'}>{t.text}</Code>)
        ctx.title = null
        break
      }
      case 'table': out.push(<Table key={key} token={t} />); break
      case 'list': out.push(ctx.related ? <Related key={key} token={t} /> : <List key={key} token={t} />); break
      case 'blockquote': out.push(<div key={key} className="doc-note">{blocks(t.tokens)}</div>); break
      case 'heading': out.push(<h5 key={key} className="doc-sub" id={t.id}><Inline tokens={t.tokens} /></h5>); break
      default: break
    }
  }
  return out
}

/* ---------- 字段卡片 ---------- */

// 属性表：位置、类型、必填、默认值、可选值、可写入 defaults
function Field({ heading, body }) {
  const ti = body.findIndex((t) => t.type === 'table' && text(t.header[0].tokens) === '属性')
  const props = Object.fromEntries(ti < 0 ? [] : body[ti].rows.map(([k, v]) => [text(k.tokens), v.tokens]))
  const rest = ti < 0 ? body : body.filter((_, i) => i !== ti)

  const req = props['必填'] ? text(props['必填']) : '否'
  const conditional = req !== '是' && req !== '否'
  const rows = [
    ['位置', props['位置']],
    ['默认值', props['默认值'] && text(props['默认值']) !== '无' ? props['默认值'] : null],
    ['可选值', props['可选值'] && text(props['可选值']) !== '—' ? props['可选值'] : null],
    ['必填条件', conditional ? props['必填'] : null],
  ].filter(([, v]) => v)

  return (
    <section className="field" id={heading.id}>
      <header className="field-head">
        <a className="field-name" href={`#${heading.id}`}>{text(heading.tokens)}</a>
        <span className="field-tags">
          {props['类型'] && <span className="field-tag is-type"><Inline tokens={props['类型']} /></span>}
          {req === '是' && <span className="field-tag is-req">必填</span>}
          {conditional && !req.startsWith('否') && <span className="field-tag is-req">条件必填</span>}
          {(req === '否' || (conditional && req.startsWith('否'))) && <span className="field-tag is-opt">可选</span>}
          {props['可写入 defaults'] && text(props['可写入 defaults']) === '是' && <span className="field-tag">可写入 defaults</span>}
        </span>
      </header>
      <div className="field-body">
        {rows.length > 0 && (
          <dl className="field-props">
            {rows.map(([k, v]) => (
              <Fragment key={k}><dt>{k}</dt><dd><Inline tokens={v} /></dd></Fragment>
            ))}
          </dl>
        )}
        {blocks(rest)}
      </div>
    </section>
  )
}

/* ---------- 页面 ---------- */

function Page({ page, index }) {
  const out = []
  const { tokens } = page
  let h2 = ''
  let seenIntro = false
  let buf = []
  const flush = () => {
    if (buf.length) out.push(...blocks(buf, { related: h2 === '相关' }).map((el, i) => <Fragment key={`${out.length}-${i}`}>{el}</Fragment>))
    buf = []
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'heading' || t.depth > 3) {
      buf.push(t)
      continue
    }
    flush()
    if (t.depth === 2) {
      h2 = text(t.tokens)
      // 每页开头的「概览」紧跟在页面标题下，不再单独出标题
      if (h2 === '概览' && !seenIntro) {
        seenIntro = true
        continue
      }
      out.push(<h3 key={t.id} className="doc-h3" id={t.id}><Inline tokens={t.tokens} /></h3>)
      if (h2 === '字段' && page.fields.length > 1) {
        out.push(
          <nav key={`${t.id}-index`} className="field-index">
            {page.fields.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
          </nav>,
        )
      }
    } else if (t.field) {
      let j = i + 1
      while (j < tokens.length && !(tokens[j].type === 'heading' && tokens[j].depth <= 3)) j++
      out.push(<Field key={t.id} heading={t} body={tokens.slice(i + 1, j)} />)
      i = j - 1
    } else {
      out.push(<h4 key={t.id} className="doc-h4" id={t.id}><Inline tokens={t.tokens} /></h4>)
    }
  }
  flush()

  return (
    <>
      <h2 className="doc-h2" id={page.slug}>
        <span className="doc-kicker">{String(index).padStart(2, '0')} · {page.slug}.md</span>
        {page.title}
      </h2>
      {page.lead && <div className="doc-lead">{blocks(page.lead)}</div>}
      {out}
    </>
  )
}

function useActiveSection() {
  const [active, setActive] = useState(TOC[0]?.id)
  useEffect(() => {
    // 当前章节 = 最后一个顶边已经过了顶栏下沿的标题
    const els = TOC.flatMap((g) => [g.id, ...g.items.map(([id]) => id)]).map((id) => document.getElementById(id)).filter(Boolean)
    let raf = 0
    const update = () => {
      raf = 0
      let current = els[0]
      for (const el of els) {
        if (el.getBoundingClientRect().top <= 140) current = el
        else break
      }
      if (current) setActive(current.id)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return active
}

function TocList({ active, onPick }) {
  return TOC.map((g) => (
    <div className="toc-group" key={g.id}>
      <a href={`#${g.id}`} className={`toc-title ${active === g.id ? 'is-active' : ''}`} onClick={onPick}>{g.group}</a>
      {g.items.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'is-active' : ''} onClick={onPick}>{label}</a>
      ))}
    </div>
  ))
}

export default function Docs() {
  const active = useActiveSection()
  const [open, setOpen] = useState(false)
  const tocRef = useRef(null)

  // 内容由 React 渲染，浏览器加载时找不到锚点，这里补一次跳转
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (!id) return
    const jump = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
    jump()
    document.fonts?.ready.then(jump) // 字体加载后行高会变，再校准一次
  }, [])

  // 侧边目录跟着当前章节滚动，只滚目录自己
  useEffect(() => {
    const box = tocRef.current
    const link = box?.querySelector('.is-active')
    if (!link) return
    const top = link.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + link.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - box.clientHeight / 3 })
    }
  }, [active])

  return (
    <>
      <div className="sk-header-wrap is-scrolled">
        <header className="sk-header">
          <a className="sk-logo" href={HOME}><span className="sk-logo-mark"><LogoIcon /></span>STYLE</a>
          <nav className="sk-nav">
            <a href={HOME} className="doc-nav-home">首页</a>
            <a href="#package">包字段</a>
            <a href="#rules" className="doc-nav-ref">规则字段</a>
            <a className="sk-nav-gh" href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </header>
      </div>

      <section className="doc-hero">
        <span className="sk-ring sk-ring-1" aria-hidden="true" />
        <div className="doc-hero-inner">
          <span className="sec-label">参考 · spec style/v0.3</span>
          <h1>STYLE.yaml<br />参考</h1>
          <p>包的形态、包级字段、规则字段、条件、原生 hook 和诊断码。每个字段列出位置、类型、默认值和校验时会报的诊断码。</p>
          <div className="doc-hero-links">
            <a className="sk-btn" href="#overview">包的形态 →</a>
            <a className="doc-ghost" href="#diagnostics">诊断码</a>
          </div>
        </div>
      </section>

      <div className="doc-layout">
        <aside className="doc-toc" ref={tocRef}>
          <TocList active={active} />
        </aside>

        <details className="doc-toc-mobile" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary>目录</summary>
          <TocList active={active} onPick={() => setOpen(false)} />
        </details>

        <article className="doc">
          {PAGES.map((p, i) => <Page key={p.slug} page={p} index={i} />)}

          <div className="doc-end">
            <p>规范、示例和源码都在 GitHub。</p>
            <a className="sk-btn" href={REPO_URL} target="_blank" rel="noreferrer">inxups/style-cli ↗</a>
          </div>
        </article>
      </div>
    </>
  )
}

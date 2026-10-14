import { INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import './sections.css'

const BUILTIN = [
  { name: 'guard', event: 'PreToolUse', icon: '⛨', bg: '#ffe14a', desc: '拦截 rm -rf、强推等危险命令，必要时改写成安全版本。' },
  { name: 'concise', event: 'UserPromptSubmit', icon: '✂', bg: '#ff7a45', desc: '先给结论，少寒暄，回答控制在必要的长度内。' },
  { name: 'tdd', event: 'PostToolUse', icon: '✓', bg: '#86f7cb', desc: '改完代码自动跑相关测试，没通过就不让收工。' },
  { name: 'journal', event: 'Stop', icon: '✎', bg: '#ff9ade', desc: '会话结束时把做了什么、改了哪些文件写进日志。' },
  { name: 'commit', event: 'PreToolUse', icon: '⌥', bg: '#a8b6ff', desc: '提交前校验信息格式，不合规范就自动改写。' },
  { name: 'scope', event: 'PreToolUse', icon: '◎', bg: '#d4f56a', desc: '只允许修改指定目录，越界的写操作直接跳过。' },
]

const EVENTS = [
  { name: 'SessionStart', zh: '会话开始', desc: '注入偏好和项目上下文', styles: ['concise'] },
  { name: 'UserPromptSubmit', zh: '提交指令', desc: '改写或补充用户指令', styles: ['concise'] },
  { name: 'PreToolUse', zh: '调用工具前', desc: '拦截、放行或修正操作', styles: ['guard', 'commit', 'scope'] },
  { name: 'PostToolUse', zh: '调用工具后', desc: '检查结果，追加动作', styles: ['tdd', 'journal'] },
  { name: 'Stop', zh: '回复结束', desc: '收尾、总结、最后把关', styles: ['tdd', 'journal'] },
]

const colorOf = (name) => BUILTIN.find((s) => s.name === name)?.bg

const CONFIG = `// .style/config.json
{
  "styles": ["guard", "concise", "tdd"]
}`

const CUSTOM = `// .style/styles/no-sleep.js
import { defineStyle, block } from 'style-hooks'

export default defineStyle({
  name: 'no-sleep',
  hooks: {
    PreToolUse: ({ tool, input }) => {
      if (tool === 'Bash' && /\\bsleep\\b/.test(input.command)) {
        return block('别用 sleep 干等，改成轮询')
      }
    },
  },
})`

// 极简语法高亮：注释、字符串、关键字
const TOKEN = /(\/\/.*$|'[^']*'|"[^"]*"|\b(?:import|from|export|default|return|if)\b)/

function Code({ children }) {
  return (
    <pre className="code">
      {children.split('\n').map((line, li) => (
        <span className="code-line" key={li}>
          {line.split(TOKEN).map((tok, i) => {
            if (!tok) return null
            if (tok.startsWith('//')) return <span key={i} className="tk-c">{tok}</span>
            if (/^['"]/.test(tok)) return <span key={i} className="tk-s">{tok}</span>
            if (/^(import|from|export|default|return|if)$/.test(tok)) return <span key={i} className="tk-k">{tok}</span>
            return tok
          })}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}

function SectionHead({ index, label, title, sub, dark = false }) {
  return (
    <div className={`sec-head ${dark ? 'on-blue' : ''}`} data-reveal>
      <span className="sec-label">{index} / {label}</span>
      <h2 className="sec-title">{title}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
    </div>
  )
}

export function QuickStart() {
  const [copied, copy] = useCopy()
  return (
    <section className="sec sec-cream" id="start">
      <div className="sec-inner">
        <SectionHead index="01" label="快速开始" title="三步，给 Agent 立规矩" sub="不用改 agent 本身，也不用学新工具。装好之后照常对话就行。" />
        <div className="steps">
          <article className="step" data-reveal>
            <span className="step-n">1</span>
            <h3>安装</h3>
            <p>在项目根目录运行，自动为当前 agent 注册 hooks。</p>
            <div className="code code-cmd">
              <code><span className="tk-c">$</span> {INSTALL_CMD}</code>
              <button onClick={() => copy()}>{copied ? '已复制' : '复制'}</button>
            </div>
          </article>
          <article className="step" data-reveal>
            <span className="step-n">2</span>
            <h3>挑选风格</h3>
            <p>在配置里列出想启用的风格，可以随时增减。</p>
            <Code>{CONFIG}</Code>
          </article>
          <article className="step" data-reveal>
            <span className="step-n">3</span>
            <h3>照常使用</h3>
            <p>agent 运行到对应节点时，风格自动生效。</p>
            <pre className="code code-log">
              <span className="log-prompt">› 清理构建产物并提交</span>
              <span><b style={{ background: '#ffe14a' }}>guard</b>已拦截 rm -rf ~/</span>
              <span><b style={{ background: '#a8b6ff' }}>commit</b>提交信息已规范</span>
              <span><b style={{ background: '#ff9ade' }}>journal</b>已记录本次会话</span>
            </pre>
          </article>
        </div>
      </div>
    </section>
  )
}

export function Lifecycle() {
  return (
    <section className="sec sec-blue" id="how">
      <span className="sec-orb" aria-hidden="true" />
      <div className="sec-inner">
        <SectionHead dark index="02" label="工作原理" title="挂在生命周期的每个节点上" sub="STYLE 在 agent 运行的五个关键时刻触发 hook。每个风格就是一组 hook，决定那一刻该做什么。" />
        <ol className="track">
          {EVENTS.map((e, i) => (
            <li className="node" key={e.name} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="node-dot" />
              <span className="node-i">0{i + 1}</span>
              <h3>{e.name}</h3>
              <span className="node-zh">{e.zh}</span>
              <p>{e.desc}</p>
              <div className="node-styles">
                {e.styles.map((s) => (
                  <span key={s}><i style={{ background: colorOf(s) }} />{s}</span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function BuiltinStyles() {
  return (
    <section className="sec sec-cream" id="styles">
      <div className="sec-inner">
        <SectionHead index="03" label="内置风格" title="开箱即用的风格" sub="每个风格都可以单独启用，也能自由组合。" />
        <div className="style-grid">
          {BUILTIN.map((s, i) => (
            <article className="style-card" key={s.name} data-reveal style={{ '--bg': s.bg, '--r': `${i % 2 ? 1.2 : -1.2}deg` }}>
              <div className="style-top">
                <span className="style-icon">{s.icon}</span>
                <span className="style-event">{s.event}</span>
              </div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CustomStyle() {
  return (
    <section className="sec sec-blue" id="custom">
      <span className="sec-ring" aria-hidden="true" />
      <div className="sec-inner custom">
        <div className="custom-copy">
          <SectionHead dark index="04" label="自定义" title="写一个你自己的风格" />
          <ul className="custom-points" data-reveal>
            <li><b>一个文件</b>就是一个风格，放进 <code>.style/styles</code> 即可生效</li>
            <li><b>按事件</b>挂 hook，拿到工具名和参数，自己决定放行、拦截还是改写</li>
            <li><b>可组合</b>，和内置风格一起使用，按配置顺序执行</li>
          </ul>
        </div>
        <div className="custom-code" data-reveal>
          <Code>{CUSTOM}</Code>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const [copied, copy] = useCopy()
  return (
    <footer className="foot">
      <div className="foot-cta" data-reveal>
        <h2>现在就给你的 Agent<br />立点规矩。</h2>
        <div className="foot-actions">
          <div className="sk-cmd">
            <code><span>$</span>{INSTALL_CMD}</code>
            <button onClick={() => copy()} aria-label="复制安装命令">{copied ? '✓' : '复制'}</button>
          </div>
          <a className="sk-btn" href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </div>
      <div className="foot-bar">
        <a className="foot-logo" href="#top"><span className="foot-mark"><LogoIcon size={20} /></span>STYLE</a>
        <span className="foot-note">开源 · MIT License</span>
        <nav>
          <a href="#start">快速开始</a>
          <a href="#how">工作原理</a>
          <a href="#styles">内置风格</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}

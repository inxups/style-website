import { DOCS_URL, INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './sections.css'

const ACTION_COLOR = { inject: '#86f7cb', warn: '#ffe14a', block: '#ff7a45' }

const RULE = `rules:
  - id: no-force-push
    target: tool
    tool: shell
    action: block
    when:
      conditions:
        - { field: tool.input.command, op: regex, pattern: 'git\\s+push.*--force' }
    text: 本仓库不允许 force push，请改用新提交。`

function SectionHead({ index, label, title, sub }) {
  return (
    <div className="sec-head" data-reveal>
      <span className="sec-label">{index} / {label}</span>
      <h2 className="sec-title">{title}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
    </div>
  )
}

function CmdLine({ cmd }) {
  const [copied, copy] = useCopy()
  return (
    <div className="code code-cmd">
      <code><span className="tk-c">$</span> {cmd}</code>
      <button onClick={() => copy(cmd)}>{copied ? '已复制' : '复制'}</button>
    </div>
  )
}

export function QuickStart() {
  return (
    <section className="sec sec-cream" id="start">
      <div className="sec-inner">
        <SectionHead index="01" label="快速开始" title="三步，给 Agent 立规矩" sub="不改 agent 本身，也不用学新工具。写好规则、装上，之后照常对话。" />
        <div className="steps">
          <article className="step" data-reveal>
            <span className="step-n">1</span>
            <h3>创建风格包</h3>
            <p>生成 STYLE.yaml、prompts/ 和 rules/ 骨架。</p>
            <CmdLine cmd="style init my-style" />
          </article>
          <article className="step" data-reveal>
            <span className="step-n">2</span>
            <h3>写规则</h3>
            <p>说清楚挂在哪、什么条件、做什么。</p>
            <Code lang="yaml">{RULE}</Code>
          </article>
          <article className="step" data-reveal>
            <span className="step-n">3</span>
            <h3>装上</h3>
            <p>自动检测 Claude Code 和 Codex，注册 hooks。</p>
            <CmdLine cmd={INSTALL_CMD} />
            <pre className="code code-log">
              <span className="log-prompt">› 整理分支后推送</span>
              <span><b style={{ background: ACTION_COLOR.block }}>block</b>已拦截 git push --force</span>
              <span><b style={{ background: ACTION_COLOR.warn }}>warn</b>新增了 TODO，已提醒</span>
              <span><b style={{ background: ACTION_COLOR.inject }}>inject</b>先给结论（常驻）</span>
            </pre>
          </article>
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
            <button onClick={() => copy()} aria-label="复制命令">{copied ? '✓' : '复制'}</button>
          </div>
          <a className="sk-btn" href={DOCS_URL}>阅读文档 →</a>
        </div>
      </div>
      <div className="foot-bar">
        <a className="foot-logo" href="#top"><span className="foot-mark"><LogoIcon size={20} /></span>STYLE</a>
        <span className="foot-note">支持 Claude Code · Codex</span>
        <nav>
          <a href={DOCS_URL}>文档</a>
          <a href="#start">快速开始</a>
          <a href="#how">工作原理</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}

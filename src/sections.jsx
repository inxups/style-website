import { DOCS_URL, INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './sections.css'

const ACTION_COLOR = { inject: '#86f7cb', warn: '#ffe14a', block: '#ff7a45' }

const NO_FORCE_PUSH = `---
target: tool
tool: shell
action: block
when:
  conditions:
    - field: tool.input.command
      op: shell_regex
      pattern: '^git push.*--force'
---
禁止 force push，请改用新提交。`

const NO_TODO = `---
target: tool
tool: [file.edit, file.write]
action: warn
when:
  conditions:
    - field: tool.added
      op: contains
      pattern: TODO
---
请勿在代码中保留 TODO。
未完成事项请在回复中列出。`

const ANSWER = `---
target: system
---
请使用中文回答，并先给出结论。`

function SectionHead({ title, sub }) {
  return (
    <div className="sec-head" data-reveal>
      <h2 className="sec-title">{title}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
    </div>
  )
}

export function Intro() {
  return (
    <section className="sec sec-cream" id="start">
      <div className="sec-inner">
        <SectionHead title="什么是 STYLE" sub="通过几行规则调整 Claude Code、Codex 等 harness 的行为，使其符合你的使用习惯。" />
        <div className="steps">
          <article className="step" data-reveal>
            <span className="step-tag" style={{ background: ACTION_COLOR.block }}>block</span>
            <h3>阻止 force push</h3>
            <p>Agent 执行 git push --force 时，拒绝该调用，并以规则正文作为拒绝理由。</p>
            <Code lang="md" title="rules/no-force-push.md">{NO_FORCE_PUSH}</Code>
          </article>
          <article className="step" data-reveal>
            <span className="step-tag" style={{ background: ACTION_COLOR.warn }}>warn</span>
            <h3>提示新增 TODO</h3>
            <p>代码改动中新增 TODO 时，向用户显示完整提示，并将首句传给 Agent。</p>
            <Code lang="md" title="rules/no-todo.md">{NO_TODO}</Code>
          </article>
          <article className="step" data-reveal>
            <span className="step-tag" style={{ background: ACTION_COLOR.inject }}>inject</span>
            <h3>统一回答规范</h3>
            <p>在每个会话中向 Agent 提供固定约定，例如回答语言和格式。</p>
            <Code lang="md" title="rules/answer.md">{ANSWER}</Code>
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
          <a href="#start">快速介绍</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}

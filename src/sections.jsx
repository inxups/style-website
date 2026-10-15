import { DOCS_URL, INSTALL_CMD, REPO_URL, useCopy } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './sections.css'

const ACTION_COLOR = { inject: '#86f7cb', warn: '#ffe14a', block: '#ff7a45' }

const TARGETS = [
  { name: 'system', where: '常驻 / 会话开始', icon: '◎', bg: '#a8b6ff', desc: '团队约定、语言和口吻。没有条件的直接写进 agent 的静态指令，不走 hook。' },
  { name: 'tool', where: '工具前后', icon: '⛨', bg: '#ffe14a', desc: '按工具分类挂载：shell、file.edit…… 执行前可以拦下，执行后可以补一句。' },
  { name: 'mcp', where: 'MCP 调用前后', icon: '⌥', bg: '#86f7cb', desc: '按 server/tool 匹配，支持通配，例如 github/create_pull_request。' },
  { name: 'skill', where: '用 skill 时', icon: '✦', bg: '#ff9ade', desc: '模型自己调用 skill，或用户点名 /name、$name，共用一条去重记录。' },
  { name: 'event', where: '任意统一事件', icon: '✎', bg: '#ff7a45', desc: '直接挂在 prompt.submitted、tool.pre 等事件上，配合条件使用。' },
  { name: 'native', where: 'M2', icon: '⚙', bg: '#d4f56a', desc: '为某个 agent 写原生 hook，不经过规则引擎。M1 校验通过、暂不安装。' },
]

const EVENTS = [
  { name: 'session.start', zh: '会话开始', native: 'SessionStart', desc: '补充会话信息；压缩上下文后补发', actions: ['inject'] },
  { name: 'prompt.submitted', zh: '提交提示', native: 'UserPromptSubmit', desc: '按提示内容追加约定，或拦下请求', actions: ['inject', 'warn', 'block'] },
  { name: 'tool.pre', zh: '调用工具前', native: 'PreToolUse', desc: '拦截危险命令，或提前说明约定', actions: ['inject', 'warn', 'block'] },
  { name: 'tool.post', zh: '调用工具后', native: 'PostToolUse', desc: '看到新增代码或输出后提醒', actions: ['inject', 'warn'] },
  { name: 'subagent.start', zh: '子 agent 启动', native: 'SubagentStart', desc: '给子 agent 带上需要的约定', actions: ['inject'] },
]

const RULE = `rules:
  - id: no-force-push
    target: tool
    tool: shell
    action: block
    when:
      conditions:
        - { field: tool.input.command, op: regex, pattern: 'git\\s+push.*--force' }
    text: 本仓库不允许 force push，请改用新提交。`

const RULE_FILE = `---
target: tool
tool: [file.edit, file.write]
action: warn
when:
  conditions:
    - { field: tool.added, op: contains, pattern: "TODO" }
---
本仓库不在代码里留 TODO 注释。没做完的事请列在回复里，方便跟踪。`

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

export function Lifecycle() {
  return (
    <section className="sec sec-blue" id="how">
      <span className="sec-orb" aria-hidden="true" />
      <div className="sec-inner">
        <SectionHead index="02" label="工作原理" title="挂在生命周期的每个节点上" sub="STYLE 把 Claude Code 和 Codex 的 hook 统一成几个时刻。规则挂在哪个时刻，就在那一刻生效；没命中时什么都不输出。" />
        <ol className="track">
          {EVENTS.map((e, i) => (
            <li className="node" key={e.name} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="node-dot" />
              <span className="node-i">0{i + 1} · {e.native}</span>
              <h3>{e.name}</h3>
              <span className="node-zh">{e.zh}</span>
              <p>{e.desc}</p>
              <div className="node-styles">
                {e.actions.map((a) => (
                  <span key={a}><i style={{ background: ACTION_COLOR[a] }} />{a}</span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Targets() {
  return (
    <section className="sec sec-cream" id="targets">
      <div className="sec-inner">
        <SectionHead index="03" label="挂载点" title="六种挂载点" sub="每条规则选一个 target。挂得越窄，越省 token。" />
        <div className="style-grid">
          {TARGETS.map((s, i) => (
            <article className="style-card" key={s.name} data-reveal style={{ '--bg': s.bg, '--r': `${i % 2 ? 1.2 : -1.2}deg` }}>
              <div className="style-top">
                <span className="style-icon">{s.icon}</span>
                <span className="style-event">{s.where}</span>
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
          <SectionHead index="04" label="规则文件" title="一个 md，就是一条规则" />
          <ul className="custom-points" data-reveal>
            <li><b>frontmatter</b> 写挂在哪、什么条件；正文写要对 agent 说的话。放进 <code>rules/</code>，在 STYLE.yaml 里用 <code>from:</code> 引入</li>
            <li><b>三种动作</b>：inject 注入，warn 给你看全文、给模型看一句，block 直接拦下</li>
            <li><b>省 token</b>：默认同一会话只注入一次，<code>style plan</code> 安装前就给出估算</li>
          </ul>
        </div>
        <div className="custom-code" data-reveal>
          <Code lang="md" title="rules/no-todo.md">{RULE_FILE}</Code>
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
          <a className="sk-btn" href={DOCS_URL}>阅读教程 →</a>
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

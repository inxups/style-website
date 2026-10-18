import { useEffect, useRef, useState } from 'react'
import { REPO_URL } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './home.css'
import './sections.css'
import './docs.css'

const HOME = import.meta.env.BASE_URL
const EXAMPLE_URL = `${REPO_URL}/blob/main/example/all-features/STYLE.yaml`

// 每组的 id 对应 H2，items 对应 H3
const TOC = [
  { id: 'overview', group: '概览', items: [['manifest', '两类声明'], ['minimal', '最小的包'], ['check', '校验与预览']] },
  { id: 'template', group: '模板 {{ }}', items: [['tpl-syntax', '语法'], ['tpl-vars', '变量'], ['tpl-static', '静态与动态']] },
  {
    id: 'package',
    group: '包字段',
    items: [['pkg-meta', '元数据'], ['pkg-env', '依赖与设置'], ['pkg-order', '排序、预算与默认值'], ['pkg-content', '规则与钩子']],
  },
  {
    id: 'rules',
    group: '规则字段',
    items: [
      ['rule-where', '标识与位置'],
      ['rule-body', '正文'],
      ['rule-action', '动作与时机'],
      ['rule-select', '选择器'],
      ['rule-when', '条件 when'],
      ['rule-repeat', '投放频率'],
      ['rule-fail', '容错与降级'],
      ['rule-misc', '排序与其他'],
    ],
  },
  { id: 'native-hooks', group: '原生钩子', items: [['hook-fields', '钩子字段'], ['hook-map', 'harness 映射']] },
  { id: 'single-file', group: '单文件包', items: [] },
]

const c = (s) => <code>{s}</code>

function H2({ id, kicker, children }) {
  return (
    <h2 className="doc-h2" id={id}>
      {kicker && <span className="doc-kicker">{kicker}</span>}
      {children}
    </h2>
  )
}

function H3({ id, children }) {
  return <h3 className="doc-h3" id={id}>{children}</h3>
}

function Note({ tone = 'info', title, children }) {
  return (
    <div className={`doc-note is-${tone}`}>
      {title && <b>{title}</b>}
      <div>{children}</div>
    </div>
  )
}

function Table({ head, rows, wrap = false }) {
  return (
    <div className={`doc-table ${wrap ? 'is-wrap' : ''}`}>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

// 字段卡片：名字 + 必填/默认值徽标 + 说明和示例
function Field({ id, name, req, def, children }) {
  return (
    <section className="field" id={id}>
      <header className="field-head">
        <a className="field-name" href={`#${id}`}>{name}</a>
        <span className="field-tags">
          {req && <span className="field-tag is-req">{req === true ? '必填' : req}</span>}
          {def !== undefined && <span className="field-tag">默认 {def}</span>}
          {!req && def === undefined && <span className="field-tag is-opt">可选</span>}
        </span>
      </header>
      <div className="field-body">{children}</div>
    </section>
  )
}

// 一组字段的快速跳转
function FieldIndex({ items }) {
  return (
    <nav className="field-index">
      {items.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
    </nav>
  )
}

const PLAN_STATUS = [
  ['native', 'harness 直接支持'],
  ['degraded', '按降级路径投放'],
  ['partial', '只有部分投放点可用'],
  ['skipped', '规则被跳过'],
  ['never-trigger', 'harness 不提供条件需要的数据，规则永远不会命中'],
  ['install-error', '安装会失败'],
]

const MINIMAL_YAML = `spec: style/v0.3
name: hello
version: 0.1.0
description: 回复先给结论
rules:
  - id: lead-with-conclusion
    target: system
    text: 先给结论，再给必要说明。`

const UNTRUSTED_OUT = `<style-untrusted-event field="tool.input.command" truncated="false">
"git push origin main"
</style-untrusted-event>`

const STATIC_DYNAMIC_YAML = `settings:
  - name: language
    default: zh-CN
rules:
  - id: static-example
    target: system
    text: 使用 {{settings.language}} 回复。字面量写作 \\{{example}}。
  - id: dynamic-example
    target: system
    text: '当前模型是 {{model | default: "unknown"}}，工作目录是 {{harness.cwd | default: "unknown"}}。'`

const NO_TODO_MD = `---
target: tool
tool: [file.edit, file.write]
action: warn
when:
  conditions:
    - {field: tool.added, op: contains, pattern: TODO}
---
不要在代码里留下 TODO 注释，未完成的工作在回复中说明。`

const NATIVE_HOOK_YAML = `native_hooks:
  - id: command-check
    description: 用本地脚本检查命令。
    fallback: skip
    codex:
      event: PreToolUse
      matcher: '^Bash$'
      command: /absolute/path/check-command.sh
      timeout: 5
    claude-code:
      event: PreToolUse
      matcher: Bash
      command: /absolute/path/check-command.sh
      timeout: 10`

const SINGLE_FILE_MD = `---
spec: style/v0.3
name: lead-with-conclusion
version: 0.1.0
description: 回复先给结论
target: system
---
先给结论，再给必要说明。`

function useActiveSection() {
  const [active, setActive] = useState('overview')
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
          <p>包的元数据、规则和原生钩子都写在这一个清单里。这里逐个列出字段的取值、默认值和校验时会报的代码。</p>
          <div className="doc-hero-links">
            <a className="sk-btn" href="#minimal">最小的包 →</a>
            <a className="doc-ghost" href="#rules">规则字段</a>
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
          {/* ---------------- 概览 ---------------- */}
          <H2 id="overview" kicker="00">概览</H2>
          <p>
            {c('STYLE.yaml')} 是 STYLE 目录包的清单文件。它声明包的元数据、规则和原生钩子，{c('style install')} 读取它，
            再把规则安装到 Codex、Claude Code 等已注册的 harness。
          </p>

          <H3 id="manifest">两类声明</H3>
          <div className="doc-split">
            <div className="doc-card">
              <span className="doc-card-key">rules</span>
              <b>由 STYLE 编译和执行</b>
              <p>STYLE 按 {c('target')} 和 {c('when')} 决定什么时候向模型注入正文、向用户发提示，或者阻止一次工具调用。</p>
            </div>
            <div className="doc-card is-alt">
              <span className="doc-card-key">native_hooks</span>
              <b>作者自己写的命令</b>
              <p>STYLE 负责审批、安装、同步和移除，命令由 harness 直接执行，不进入规则引擎、模板、去重和 token 预算。</p>
            </div>
          </div>

          <H3 id="minimal">最小的包</H3>
          <p>一个包至少要有一条规则或一个原生钩子。</p>
          <Code lang="yaml" title="hello/STYLE.yaml">{MINIMAL_YAML}</Code>

          <H3 id="check">校验与预览</H3>
          <p>写完后先运行 {c('validate')} 检查字段，再运行 {c('plan')} 查看每条规则在各 harness 上的投放结果。</p>
          <Code lang="bash" copy>{`style validate ./hello
style plan ./hello --harness codex,claude-code`}</Code>
          <p>{c('plan')} 给每条规则一个状态：</p>
          <div className="status-grid">
            {PLAN_STATUS.map(([k, v]) => (
              <div key={k} className={`status is-${k}`}><code>{k}</code><span>{v}</span></div>
            ))}
          </div>
          <Note title="不是 YAML 字段">
            安装来源、项目作用域、trust、sync、update 等由 CLI 参数管理。完整的可运行示例见{' '}
            <a href={EXAMPLE_URL} target="_blank" rel="noreferrer">example/all-features/STYLE.yaml ↗</a>。
          </Note>

          {/* ---------------- 模板 ---------------- */}
          <H2 id="template" kicker="01">模板 <code className="doc-h2-code">{'{{ }}'}</code></H2>
          <p>规则正文可以引用变量。STYLE 只做替换，没有条件、循环和函数。</p>

          <H3 id="tpl-syntax">语法</H3>
          <Table
            head={['写法', '含义']}
            rows={[
              [c('{{name}}'), '输出变量值。变量缺失时输出空字符串。'],
              [c('{{name | default: "值"}}'), <>变量缺失时输出 {c('值')}。单引号也可以。</>],
              [c('\\{{'), <>输出字面的 {c('{{')}，反斜杠不输出。</>],
            ]}
          />
          <p>
            {c('{{')} 和 {c('}}')} 内侧以及 {c('|')} 两侧的空格会被忽略。{c('default')} 只能跟一个带引号的字符串，字符串内不能再出现同一种引号。
            变量值存在但为空字符串时，STYLE 输出空字符串，不使用 {c('default')}。
          </p>
          <div className="doc-split">
            <div className="doc-card">
              <b>模板生效的位置</b>
              <ul className="doc-list">
                <li>规则的 {c('text')}</li>
                <li>{c('file')} 引用的正文文件</li>
                <li>{c('from')} 引用的规则文件正文</li>
                <li>{c('model_text')}</li>
              </ul>
            </div>
            <div className="doc-card is-muted">
              <b>不做模板处理</b>
              <p>{c('native_hooks')} 的 {c('description')} 和 {c('command')}。</p>
            </div>
          </div>

          <H3 id="tpl-vars">变量</H3>
          <div className="var-kinds">
            <div><span>安装时</span><b>{c('settings.NAME')}</b><p>{c('NAME')} 必须在顶层 {c('settings')} 中声明，值在安装时确定。只含安装时变量的正文是<b>静态正文</b>。</p></div>
            <div><span>运行时</span><b>{c('model')}、{c('harness.*')} …</b><p>在每次事件发生时取值。正文只要引用一个运行时变量就成为<b>动态正文</b>。</p></div>
            <div className="is-hot"><span>事件</span><b>{c('event.*')}</b><p>内容来自用户输入或工具输出，STYLE 把它当作<b>不可信数据</b>。</p></div>
          </div>

          <p className="doc-sub">运行时变量</p>
          <Table
            head={['变量', '内容']}
            rows={[
              [c('model'), '模型名'],
              [c('provider'), '服务提供方标识'],
              [c('thinking_effort'), '归一化后的推理档位'],
              [c('thinking_effort_raw'), 'harness 报告的原始推理档位'],
              [c('harness.name'), <>harness 名称，如 {c('codex')}</>],
              [c('harness.version'), 'harness 版本'],
              [c('harness.cwd'), '工作目录'],
              [c('harness.permission_mode'), '权限模式'],
              [c('harness.agent'), '代理名'],
              [c('harness.session_id'), '会话 ID'],
              [c('harness.turn_id'), '轮次 ID'],
            ]}
          />
          <p>
            运行时变量没有 {c('default')}，{c('when')} 也没有排除缺失值时，{c('validate')} 给出 {c('var-no-default')} 警告。
            {c('harness.session_id')} 和 {c('harness.turn_id')} 每次事件都会变，会让 {c('repeat')} 去重失效，{c('validate')} 给出 {c('T006')} 警告。
          </p>

          <p className="doc-sub">事件变量</p>
          <Table
            head={['变量', '内容']}
            rows={[
              [c('event.prompt'), '用户提交的提示'],
              [c('event.tool.name'), '工具原生名'],
              [c('event.tool.input'), '工具输入'],
              [c('event.tool.input.KEY'), <>工具输入中的字段，可以多级，如 {c('event.tool.input.command')}</>],
              [c('event.tool.added'), '编辑工具新增的内容'],
              [c('event.tool.output'), '工具输出'],
              [c('event.mcp.server'), 'MCP 服务名'],
              [c('event.mcp.tool'), 'MCP 工具名'],
              [c('event.skill.name'), '技能名'],
            ]}
          />
          <p>STYLE 渲染事件变量时会做三件事：把值截断到 512 个字符，按 JSON 字符串转义，再包进固定边界。</p>
          <Code title="渲染结果">{UNTRUSTED_OUT}</Code>
          <p>事件变量还有三条限制：</p>
          <ul className="doc-list">
            <li>
              变量必须在规则的投放点可用。例如 {c('event.tool.output')} 只在工具执行后可用，写在 {c('at: before')} 的规则里会报 {c('event-var-unavailable')}。
            </li>
            <li>{c('action: warn')} 的规则引用事件变量时必须显式写 {c('model_text')}，否则报 {c('event-warn-model-text')}。</li>
            <li>
              不带 {c('event.')} 前缀的 {c('{{prompt}}')}、{c('{{tool.input}}')} 等写法会报 {c('event-var-in-template')}。这些名字只能用在 {c('when.conditions')} 中。
            </li>
          </ul>
          <p>未声明的 {c('settings.*')} 和不认识的变量名都报 {c('undeclared-var')}。</p>

          <H3 id="tpl-static">静态与动态</H3>
          <p>正文是静态还是动态，会影响投放方式。</p>
          <Table
            head={['正文', '投放方式']}
            rows={[
              ['静态', <>{c('system')} 规则可以写进 harness 的静态指令位置，如 {c('AGENTS.md')} 或 {c('CLAUDE.md')}</>],
              ['动态', '只能通过钩子在会话开始或提交提示时注入'],
            ]}
          />
          <p>{c('mode: replace')} 只接受静态正文。</p>
          <Code lang="yaml">{STATIC_DYNAMIC_YAML}</Code>
          <Note tone="warn" title="注意 YAML 的冒号">
            {c('default: ')} 中有冒号加空格，YAML 会把它当成键值分隔符。含 {c('default')} 的单行正文要用单引号括起来，或者改用 {c('|')} 多行写法。
          </Note>

          {/* ---------------- 包字段 ---------------- */}
          <H2 id="package" kicker="02">包字段</H2>
          <FieldIndex
            items={[
              ['pkg-spec', 'spec'], ['pkg-name', 'name'], ['pkg-version', 'version'], ['pkg-description', 'description'],
              ['pkg-authors', 'authors'], ['pkg-requires', 'requires'], ['pkg-settings', 'settings'], ['pkg-recommends', 'recommends'],
              ['pkg-priority', 'priority'], ['pkg-budget', 'budget'], ['pkg-defaults', 'defaults'], ['pkg-rules', 'rules'],
              ['pkg-native_hooks', 'native_hooks'],
            ]}
          />

          <H3 id="pkg-meta">元数据</H3>
          <Field id="pkg-spec" name="spec" req>
            <p>规范版本，目前只接受 {c('style/v0.3')}。</p>
            <Code lang="yaml">{`spec: style/v0.3`}</Code>
          </Field>
          <Field id="pkg-name" name="name" req>
            <p>包名，由小写字母、数字和 {c('-')} 组成，以字母或数字开头，最长 64 个字符。</p>
            <Code lang="yaml">{`name: terse-reviewer`}</Code>
          </Field>
          <Field id="pkg-version" name="version" req>
            <p>包版本，使用语义化版本。</p>
            <Code lang="yaml">{`version: 1.2.0-beta.1`}</Code>
          </Field>
          <Field id="pkg-description" name="description" req>
            <p>一句话说明包的用途，不能为空。</p>
            <Code lang="yaml">{`description: 代码评审时只报告有证据的问题`}</Code>
          </Field>
          <Field id="pkg-authors" name="authors">
            <p>作者，可以写一个字符串或字符串列表。</p>
            <Code lang="yaml">{`authors: [inxups]`}</Code>
          </Field>

          <H3 id="pkg-env">依赖与设置</H3>
          <Field id="pkg-requires" name="requires">
            <p>
              声明 STYLE 运行时和 harness 的版本要求。{c('runtime')} 约束 STYLE 本身，{c('harness')} 下按 harness 名写约束。
              每项写一个约束，支持 {c('>=')}、{c('<=')}、{c('>')}、{c('<')}、{c('=')}、{c('^')}、{c('~')} 或精确版本。
            </p>
            <Code lang="yaml">{`requires:
  runtime: '>=0.3.0'
  harness:
    codex: '>=0.159.3'
    claude-code: '>=2.1.300'`}</Code>
          </Field>
          <Field id="pkg-settings" name="settings">
            <p>
              声明安装时变量，供模板以 {c('{{settings.NAME}}')} 引用。没有 {c('default')} 的设置在安装时必须用 {c('--set NAME=值')} 提供。
            </p>
            <p>每项接受三个字段：{c('name')} 必填；{c('description')} 和 {c('default')} 可选，值都是字符串，数字也要加引号。</p>
            <Code lang="yaml">{`settings:
  - name: language
    description: 回复语言
    default: zh-CN
  - name: max_findings
    description: 评审最多列出的发现数量
    default: '10'`}</Code>
            <p>安装时覆盖默认值：</p>
            <Code lang="bash" copy>{`style install ./my-style --set language=en --set max_findings=5`}</Code>
          </Field>
          <Field id="pkg-recommends" name="recommends">
            <p>按 harness 列出建议的设置项。STYLE 只在报告中显示，不改写 harness 设置。</p>
            <Code lang="yaml">{`recommends:
  codex:
    model_reasoning_effort: high
  claude-code:
    effortLevel: high`}</Code>
          </Field>

          <H3 id="pkg-order">排序、预算与默认值</H3>
          <Field id="pkg-priority" name="priority" def="50">
            <p>包级排序优先级，规则和原生钩子没有写 {c('priority')} 时使用这个值。数字小的先输出，可以是小数。</p>
            <Code lang="yaml">{`priority: 30`}</Code>
          </Field>
          <Field id="pkg-budget" name="budget" def={<>见下表</>}>
            <p>token 预算。STYLE 用估算值检查以下三项。</p>
            <Table
              head={['字段', '默认', '检查对象', '超出时']}
              rows={[
                [c('per_rule'), '400', <>单条规则的正文。也是规则 {c('max_tokens')} 的默认值。</>, c('T001')],
                [c('per_event'), '1200', '同一个事件上所有规则的正文之和', c('T002')],
                [c('always_on'), '600', '写进静态指令位置的正文之和', c('T004')],
              ]}
            />
            <p>
              {c('on')} 默认 {c('warn')}，让超预算只产生警告；{c('on: error')} 把超预算当作错误。引用 {c('event.*')} 的正文按最坏情况估算。
              这个预算和 harness 自身的上下文上限无关。
            </p>
            <Code lang="yaml">{`budget:
  per_rule: 800
  per_event: 2000
  always_on: 1000
  on: error`}</Code>
          </Field>
          <Field id="pkg-defaults" name="defaults">
            <p>给本包所有规则设置默认值。合并顺序从低到高：</p>
            <ol className="doc-steps">
              <li>标准默认值</li>
              <li>{c('defaults')}</li>
              <li>规则文件 frontmatter</li>
              <li>{c('from')} 条目上的覆盖值</li>
            </ol>
            <p>
              只接受 {c('action')}、{c('at')}、{c('repeat')}、{c('fail')}、{c('refresh')}、{c('reinject_on_compact')}、{c('sources')}、{c('fallback')}、{c('priority')}、{c('max_tokens')}。
              写其他字段报 {c('defaults-field')}。{c('native_hooks')} 不读取 {c('defaults')}。
            </p>
            <Code lang="yaml">{`defaults:
  fallback: skip
  priority: 40
  max_tokens: 300`}</Code>
          </Field>

          <H3 id="pkg-content">规则与钩子</H3>
          <Field id="pkg-rules" name="rules">
            <p>规则列表。每项是一条内联规则，或者一个 {c('from')} 条目。字段见<a href="#rules">规则字段</a>。</p>
          </Field>
          <Field id="pkg-native_hooks" name="native_hooks">
            <p>原生钩子列表。字段见<a href="#native-hooks">原生钩子</a>。规则和原生钩子的 {c('id')} 在同一个包内不能重复。</p>
          </Field>

          {/* ---------------- 规则字段 ---------------- */}
          <H2 id="rules" kicker="03">规则字段</H2>
          <FieldIndex
            items={[
              ['rule-id', 'id'], ['rule-target', 'target'], ['rule-mode', 'mode'], ['rule-text', 'text'], ['rule-file', 'file'],
              ['rule-from', 'from'], ['rule-action-field', 'action'], ['rule-model_text', 'model_text'], ['rule-at', 'at'],
              ['rule-tool', 'tool'], ['rule-names', 'names'], ['rule-mcp', 'mcp'], ['rule-skill', 'skill'], ['rule-event', 'event'],
              ['rule-when', 'when'], ['rule-repeat-field', 'repeat'], ['rule-refresh', 'refresh'],
              ['rule-reinject_on_compact', 'reinject_on_compact'], ['rule-sources', 'sources'], ['rule-fail-field', 'fail'],
              ['rule-fallback', 'fallback'], ['rule-priority', 'priority'], ['rule-max_tokens', 'max_tokens'],
              ['rule-reason', 'reason'], ['rule-enabled', 'enabled'],
            ]}
          />

          <H3 id="rule-where">标识与位置</H3>
          <Field id="rule-id" name="id" req="内联规则必填">
            <p>
              规则标识，由小写字母、数字和 {c('_ . / -')} 组成，以字母或数字开头，最长 128 个字符，不能含 {c('..')} 或 {c('//')}，不能以 {c('/')} 开头或结尾。
            </p>
            <p>
              {c('from')} 引用的规则文件可以省略 {c('id')}，STYLE 用文件相对 {c('rules/')} 的路径去掉 {c('.md')} 作为 {c('id')}：
              {c('rules/review/strict.md')} 的 {c('id')} 是 {c('review/strict')}。单文件包省略 {c('id')} 时使用包名。
            </p>
            <Code lang="yaml">{`- id: review/strict
  target: system
  text: 只报告能复现的问题。`}</Code>
          </Field>
          <Field id="rule-target" name="target" req>
            <p>决定规则在哪里生效。{c('fallback: degrade')} 时，各个 {c('target')} 的降级路径见 <a href="#rule-fallback">{c('fallback')}</a>。</p>
            <Table
              head={['值', '生效位置', '必需的选择器']}
              rows={[
                [c('system'), '会话级指令', '无'],
                [c('tool'), '工具调用前后', <>{c('tool')} 或 {c('names')}</>],
                [c('mcp'), 'MCP 工具调用前后', c('mcp')],
                [c('skill'), '技能调用', c('skill')],
                [c('event'), '指定的标准事件', c('event')],
              ]}
            />
            <p>{c('target: native')} 已移除，原生命令改写到 <a href="#native-hooks">{c('native_hooks')}</a>。</p>
            <Code lang="yaml">{`- id: before-shell
  target: tool
  tool: shell
  at: before
  text: 执行前确认工作目录。`}</Code>
          </Field>
          <Field id="rule-mode" name="mode" def={c('append')}>
            <p>
              只用于 {c('target: system')}。{c('append')} 把正文追加到 harness 的指令中。{c('replace')} 替换 harness 的静态指令，
              要求正文是静态正文，不能有 {c('when')}，{c('refresh')} 必须为 0，安装时还要加 {c('--allow-replace')}。
            </p>
            <p>不能降级：{c('mode: replace')} 在 harness 没有静态替换位置时直接失败。</p>
            <Code lang="yaml">{`- id: replace-system
  target: system
  mode: replace
  fallback: error
  text: 使用 {{settings.language}} 回复，先给结论。`}</Code>
          </Field>

          <H3 id="rule-body">正文</H3>
          <p>内联规则用 {c('text')} 或 {c('file')} 给出正文，二选一；也可以用 {c('from')} 引用规则文件。</p>
          <Field id="rule-text" name="text">
            <p>内联规则的正文，可以使用模板。正文不能为空，不能含 {c('<!-- style:')} 标记。</p>
            <Code lang="yaml">{`- id: style-guide
  target: system
  text: |
    先给结论，再给必要说明。
    未运行的检查要明确说明。`}</Code>
          </Field>
          <Field id="rule-file" name="file">
            <p>从包内文件读取正文，与 {c('text')} 互斥。文件只放纯正文，不能有 frontmatter，不能放在 {c('rules/')} 下。</p>
            <Code lang="yaml">{`- id: style-guide
  target: system
  file: prompts/style.md`}</Code>
          </Field>
          <Field id="rule-from" name="from">
            <p>
              引用 {c('rules/')} 下带 YAML frontmatter 的 Markdown 规则文件。frontmatter 写规则字段，正文就是规则正文。
              支持 {c('rules/*.md')} 和 {c('rules/**/*.md')}，匹配到的文件按路径字典序展开成多条规则。没有被 {c('from')} 引用的规则文件不会加载。
            </p>
            <p>
              {c('from')} 条目上可以覆盖规则字段，但不能写 {c('id')}、{c('target')}、{c('file')} 和 {c('text')}。覆盖 {c('when')} 时替换整个 {c('when')}，不做深层合并。
            </p>
            <Code lang="yaml">{`rules:
  - from: rules/no-todo-comments.md
    priority: 40
    when: {harness: {name: codex}}
  - from: rules/review/*.md`}</Code>
            <Code lang="md" title="rules/no-todo-comments.md">{NO_TODO_MD}</Code>
            <p>包内文件不能是符号链接，不能用 {c('..')} 跳出包目录，单个文件最大 256 KiB。</p>
          </Field>

          <H3 id="rule-action">动作与时机</H3>
          <Field id="rule-action-field" name="action" def={c('inject')}>
            <p>规则命中后的动作。</p>
            <Table
              head={['值', '效果']}
              rows={[
                [c('inject'), '把正文作为上下文注入给模型'],
                [c('warn'), <>把 {c('text')} 作为提示显示给用户，把 {c('model_text')} 注入给模型</>],
                [c('block'), <>阻止这次调用，{c('text')} 作为拒绝原因</>],
              ]}
            />
            <p>
              {c('block')} 只能用于 {c('target')} 为 {c('tool')}、{c('mcp')}、{c('skill')} 的规则，或者 {c('event')} 为 {c('tool.pre')}、{c('prompt.submitted')} 的规则，并且不能 {c('at: after')}。
              {c('fallback: degrade')} 时，如果投放点不能拒绝工具调用，{c('block')} 降级为 {c('warn')}，{c('repeat')} 改为 {c('every')}。
            </p>
            <Code lang="yaml">{`- id: block-force-push
  target: tool
  tool: shell
  action: block
  when:
    conditions:
      - {field: tool.input.command, op: shell_regex, pattern: '^git\\s+push\\s+.*--force(?:\\s|$)'}
  text: 不要强制推送，请新建提交。`}</Code>
          </Field>
          <Field id="rule-model_text" name="model_text" def={<>{c('text')} 的第一句</>}>
            <p>
              {c('action: warn')} 规则中给模型的文本，可以使用模板。写成空字符串 {c("''")} 时不给模型发送任何文本。
              引用 {c('event.*')} 时必须显式写。其他 {c('action')} 写了会得到 {c('model-text-unused')} 警告。
            </p>
            <Code lang="yaml">{`- id: warn-recursive-delete
  target: tool
  tool: shell
  at: before
  action: warn
  when:
    conditions:
      - {field: tool.input.command, op: shell_regex, pattern: '^rm\\s+-[A-Za-z]*r'}
  text: 递归删除命令即将执行，请检查目标路径。
  model_text: 执行递归删除前，先确认目标路径和需要保留的文件。`}</Code>
          </Field>
          <Field id="rule-at" name="at" def={<>{c('after')}；{c('block')} 为 {c('before')}</>}>
            <p>
              用于 {c('tool')}、{c('mcp')}、{c('skill')} 规则。{c('before')} 在调用执行前评估，对应 {c('tool.pre')}；{c('after')} 在执行后评估，对应 {c('tool.post')}。
            </p>
            <p>
              {c('fallback: degrade')} 时，如果指定的时机不可用，{c('inject')} 和 {c('warn')} 规则改用另一个时机；{c('block')} 规则不换时机。
            </p>
            <Code lang="yaml">{`- id: after-edit
  target: tool
  tool: file.edit
  at: after
  text: 编辑后运行相关测试。`}</Code>
          </Field>

          <H3 id="rule-select">选择器</H3>
          <p>每种 {c('target')} 用自己的选择器指定作用对象。</p>
          <Field id="rule-tool" name="tool">
            <p>
              {c('target: tool')} 的标准工具类别，可以写一个或一个列表。常见类别有 {c('shell')}、{c('file.read')}、{c('file.write')}、{c('file.edit')}、{c('search')}、{c('fetch')}、{c('task')}、{c('mcp')}、{c('other')}。
              同时写 {c('tool')} 和 {c('names')} 时，命中任意一个即可。
            </p>
            <Code lang="yaml">{`tool: [file.edit, file.write]`}</Code>
          </Field>
          <Field id="rule-names" name="names">
            <p>{c('target: tool')} 的 harness 原生工具名，支持 {c('*')} 通配。</p>
            <Code lang="yaml">{`names: [Bash, Edit, apply_patch]`}</Code>
          </Field>
          <Field id="rule-mcp" name="mcp">
            <p>{c('target: mcp')} 的选择器，格式为 {c('服务名/工具名')}，两段都支持通配。</p>
            <Code lang="yaml">{`mcp: [github/create_pull_request, 'github/*']`}</Code>
          </Field>
          <Field id="rule-skill" name="skill">
            <p>{c('target: skill')} 的技能名，支持通配。规则在显式调用技能时生效，也在 harness 能观察到的隐式技能读取时生效。</p>
            <Code lang="yaml">{`skill: [code-review, review-*]`}</Code>
          </Field>
          <Field id="rule-event" name="event" req={<>{c('target: event')} 必填</>}>
            <p>取以下六个标准事件之一。</p>
            <Table
              head={['值', '触发时机']}
              rows={[
                [c('session.start'), <>会话开始，按 {c('sources')} 筛选来源</>],
                [c('prompt.submitted'), '用户提交提示'],
                [c('tool.pre'), '任意工具执行前'],
                [c('tool.post'), '任意工具执行后'],
                [c('tool.error'), '工具执行失败'],
                [c('subagent.start'), '子代理启动'],
              ]}
            />
            <p>
              各 harness 支持的事件不同。例如当前 Codex 适配器不能在 {c('tool.error')} 输出，Claude Code 适配器不能在 {c('subagent.start')} 输出上下文，{c('plan')} 会把这类规则标为跳过。
            </p>
            <Code lang="yaml">{`- id: after-test
  target: event
  event: tool.post
  repeat: every
  reason: 每次测试后依据实际输出汇报结果。
  when:
    conditions:
      - {field: tool.output, op: contains, pattern: FAIL}
  text: 测试输出含 FAIL，先定位失败原因再继续。`}</Code>
          </Field>

          <H3 id="rule-when">条件 when</H3>
          <p>
            可选。规则的命中条件。<b>不同字段之间是 AND，同一字段的列表是 OR，{c('conditions')} 的各项之间是 AND。</b>
            harness 不提供某个条件需要的数据时，规则在该 harness 上标为 {c('never-trigger')}。
          </p>
          <Code lang="yaml">{`when:
  model: [gpt-*, '**/claude-*']
  thinking_effort: '>=high'
  agent: main
  conditions:
    - {field: tool.input.command, op: starts_with, pattern: 'git '}`}</Code>

          <Field id="when-model" name="when.model">
            <p>
              模型名的 glob，不区分大小写。{c('*')} 不匹配 {c('/')}，{c('**')} 可以跨 {c('/')}。普通通配符不匹配未知模型，要匹配模型缺失的情况须显式写 {c('unknown')}。
            </p>
            <Code lang="yaml">{`when:
  model: [gpt-*, '**/claude-*', unknown]`}</Code>
          </Field>
          <Field id="when-provider" name="when.provider">
            <p>服务提供方标识，如 {c('openai')}、{c('anthropic')}，不写 URL。支持 {c('unknown')}。</p>
            <Code lang="yaml">{`when:
  provider: [openai, anthropic]`}</Code>
          </Field>
          <Field id="when-thinking_effort" name="when.thinking_effort">
            <p>推理档位，有序档位从低到高：</p>
            <div className="effort-scale">
              {['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map((e) => <span key={e}>{e}</span>)}
            </div>
            <p>
              可以写单个档位、档位列表、{c('>=档位')} 或 {c('<=档位')}。另外支持 {c('open')} 和 {c('unknown')}，{c('open')} 不参与比较。
            </p>
            <Code lang="yaml">{`when:
  thinking_effort: '>=high'`}</Code>
          </Field>
          <Field id="when-thinking_effort_approx" name="when.thinking_effort_approx">
            <p>
              布尔值。harness 的档位不能精确对应标准档位时，STYLE 用近似映射并把这个值设为 {c('true')}。用它区分精确档位和近似档位。
            </p>
            <Code lang="yaml">{`when:
  thinking_effort: [low, medium]
  thinking_effort_approx: true`}</Code>
          </Field>
          <Field id="when-harness" name="when.harness">
            <p>按 harness 筛选，接受 {c('name')} 和 {c('permission_mode')} 两个子字段。{c('permission_mode')} 支持 {c('unknown')}。</p>
            <Code lang="yaml">{`when:
  harness:
    name: [codex, claude-code]
    permission_mode: [default, acceptEdits]`}</Code>
          </Field>
          <Field id="when-agent" name="when.agent" def={c('main')}>
            <p>
              默认只匹配主代理 {c('main')}；{c('event: subagent.start')} 的规则默认匹配所有代理。写 {c('any')} 匹配所有代理，也可以写代理类型或列表。
            </p>
            <Code lang="yaml">{`when:
  agent: [reviewer, explorer]`}</Code>
          </Field>
          <Field id="when-conditions" name="when.conditions">
            <p>字段条件列表，每项有 {c('field')}、{c('op')}、{c('pattern')} 三个字段，值都是字符串。</p>
            <Table
              head={['op', '含义']}
              rows={[
                [c('equals'), '完全相等'],
                [c('contains'), '包含'],
                [c('not_contains'), '不包含'],
                [c('starts_with'), <>以 {c('pattern')} 开头</>],
                [c('ends_with'), <>以 {c('pattern')} 结尾</>],
                [c('regex'), 'RE2 正则'],
                [c('shell_regex'), '先把命令解析成简单命令，去掉引号，再逐条用 RE2 正则匹配。引号内文本、注释和 heredoc 数据不会误匹配。'],
              ]}
            />
            <p>
              可用的 {c('field')} 有 {c('prompt')}、{c('tool.name')}、{c('tool.canonical')}、{c('tool.input')}、{c('tool.input.KEY')}、{c('tool.added')}、{c('tool.output')}、{c('mcp.server')}、{c('mcp.tool')}、{c('skill.name')}、{c('cwd')}。
            </p>
            <p>
              字段必须在规则的投放点可用，否则报 {c('condition-field-wrong-event')}。例如 {c('tool.output')} 只在 {c('at: after')} 或 {c('event: tool.post')} 时可用。
              字段缺失时条件不命中，{c('not_contains')} 也不命中。
            </p>
            <Code lang="yaml">{`when:
  agent: any
  conditions:
    - {field: tool.canonical, op: equals, pattern: shell}
    - {field: tool.input.command, op: shell_regex, pattern: '^rm\\s'}
    - {field: cwd, op: not_contains, pattern: /vendor/}`}</Code>
          </Field>

          <H3 id="rule-repeat">投放频率</H3>
          <Field id="rule-repeat-field" name="repeat" def={<>{c('session')}；{c('warn')} 为 {c('every')}</>}>
            <p>控制同一条规则多久投放一次。</p>
            <Table
              head={['值', '投放']}
              rows={[
                [c('session'), '每个会话一次'],
                [c('turn'), '每轮一次'],
                [c('every'), '每次命中都投放'],
              ]}
            />
            <p>
              {c('block')} 规则忽略 {c('repeat')}，每次都检查，写了会得到 {c('block-repeat')} 警告。{c('inject')} 规则使用 {c('turn')} 或 {c('every')} 时应写 {c('reason')}，否则得到 {c('T007')} 警告。
            </p>
            <Code lang="yaml">{`- id: shell-reminder
  target: tool
  tool: shell
  at: before
  repeat: turn
  reason: 每轮第一次执行命令前重申检查项。
  text: 执行前确认工作目录，完成后检查退出码。`}</Code>
          </Field>
          <Field id="rule-refresh" name="refresh" def={<>0（关闭）</>}>
            <p>
              在 {c('repeat: session')} 的基础上定期重新投放。值为 N 时，距上次投放至少 N 次提示后再投放一次，范围 0 到 1000000。
            </p>
            <p>
              正数要求 {c('action')} 为 {c('inject')} 或 {c('warn')}、{c('repeat: session')}、{c('mode')} 不是 {c('replace')}、{c('event')} 不是 {c('subagent.start')}，否则报 {c('refresh-incompatible')}。
              {c('system')} 规则使用 {c('refresh')} 时需要 harness 能在 {c('prompt.submitted')} 输出。{c('inject')} 规则使用 {c('refresh')} 时应写 {c('reason')}。
            </p>
            <Code lang="yaml">{`- id: style-refresh
  target: system
  repeat: session
  refresh: 5
  reason: 长会话容易偏离风格约定，每五次提示重申一次。
  text: 先给结论，并标注 file:line。`}</Code>
          </Field>
          <Field id="rule-reinject_on_compact" name="reinject_on_compact" def={<>{c('system')} 为 {c('true')}，其他 {c('false')}</>}>
            <p>
              上下文压缩后重新投放 {c('repeat: session')} 的规则，避免规则在压缩摘要里丢失。其他 {c('repeat')} 值写了会得到 {c('reinject-unused')} 警告。
            </p>
            <Code lang="yaml">{`- id: session-facts
  target: event
  event: session.start
  repeat: session
  reinject_on_compact: true
  text: '当前模型：{{model | default: "unknown"}}。'`}</Code>
          </Field>
          <Field id="rule-sources" name="sources" def={c('[startup, clear, fork]')}>
            <p>
              筛选会话开始的来源，可选值为 {c('startup')}、{c('resume')}、{c('clear')}、{c('fork')}、{c('compact')}。
              默认不包含 {c('resume')} 和 {c('compact')}，恢复会话和压缩后不会触发，需要时显式列出。
            </p>
            <p>只对 {c('target: system')} 和 {c('event: session.start')} 的规则生效，其他规则写了会得到 {c('sources-unused')} 警告。</p>
            <Code lang="yaml">{`- id: resume-recheck
  target: event
  event: session.start
  sources: [resume]
  text: 会话已恢复，工作树可能已变化，先重新运行 git status。`}</Code>
          </Field>

          <H3 id="rule-fail">容错与降级</H3>
          <Field id="rule-fail-field" name="fail" def={c('open')}>
            <p>
              规则评估出错时的处理方式。{c('open')} 放行，{c('closed')} 拒绝这次调用。{c('closed')} 只能用于可以直接阻断的位置，即 {c('at: before')} 的 {c('tool')}、{c('mcp')}、{c('skill')} 规则，
              或 {c('event')} 为 {c('tool.pre')}、{c('prompt.submitted')} 的规则，否则报 {c('fail-closed-target')}。
            </p>
            <p>评估出错时，{c('closed')} 保护的是整个原生事件，不受本规则条件的限制。安装级的 {c('--fail-closed')} 由 CLI 单独配置。</p>
            <Code lang="yaml">{`- id: block-demo
  target: tool
  tool: shell
  at: before
  action: block
  fail: closed
  when:
    conditions:
      - {field: tool.input.command, op: shell_regex, pattern: '^style-demo-forbidden(?:\\s|$)'}
  text: 该命令被规则阻止。`}</Code>
          </Field>
          <Field id="rule-fallback" name="fallback" def={c('degrade')}>
            <p>harness 不能按声明投放规则时的处理方式。</p>
            <Table
              head={['值', '处理']}
              rows={[
                [c('degrade'), '尝试下面的降级路径'],
                [c('skip'), '跳过这条规则'],
                [c('error'), '让安装失败'],
              ]}
            />
            <p>条件数据缺失时，{c('degrade')} 和 {c('skip')} 都把规则标为 {c('never-trigger')}，{c('error')} 仍然让安装失败。</p>
            <p className="doc-sub">degrade 的降级路径</p>
            <Table
              wrap
              head={['情况', '降级方式']}
              rows={[
                [<>静态 {c('system')} 规则，harness 没有静态指令位置</>, <>改为在 {c('session.start')} 注入。{c('session.start')} 也不可用时改为在 {c('prompt.submitted')} 注入，每会话一次。</>],
                [<>动态 {c('system')} 规则，{c('session.start')} 和 {c('prompt.submitted')} 只有一个可用</>, '只用可用的那个。'],
                [<>{c('tool')}、{c('mcp')}、{c('skill')} 规则的 {c('at')} 时机不可用</>, <>改用另一个时机。{c('block')} 规则除外。</>],
                [<>{c('tool')}、{c('mcp')}、{c('skill')} 规则所有钩子投放点都不可用</>, <>静态正文、无 {c('when')}、{c('refresh')} 为 0 的 {c('inject')} 规则改写进静态指令位置，正文前加 {c('When using shell: ')} 这样的前缀。</>],
                [<>{c('block')} 的投放点不能拒绝调用</>, <>降为 {c('warn')}，{c('repeat: every')}。</>],
                [<>{c('warn')} 的投放点只支持用户提示和模型上下文中的一种</>, <>只用支持的那一种，状态为 {c('partial')}。</>],
              ]}
            />
            <Note tone="warn">
              {c('mode: replace')} 不降级。动态 {c('system')} 规则在所有投放点都不可用时，即使是 {c('degrade')} 也会让安装失败，不会静默消失。
            </Note>
            <Code lang="yaml">{`- id: before-create-pr
  target: mcp
  mcp: github/create_pull_request
  at: before
  fallback: skip
  text: 创建前检查标题和实际执行的验证结果。`}</Code>
          </Field>

          <H3 id="rule-misc">排序与其他</H3>
          <Field id="rule-priority" name="priority" def={<>包级 {c('priority')}，否则 50</>}>
            <p>
              同一事件上多条规则的输出顺序，数字小的先输出，可以是小数，不能为负数。数字相同时按包的安装顺序和规则在包内的顺序排列。
            </p>
            <Code lang="yaml">{`- id: style-guide
  target: system
  priority: 10
  text: 先给结论。`}</Code>
          </Field>
          <Field id="rule-max_tokens" name="max_tokens" def={<>{c('budget.per_rule')}，否则 400</>}>
            <p>单条规则正文的 token 上限，超出时按 {c('budget.on')} 产生 {c('T001')} 警告或错误。不能为负数。</p>
            <Code lang="yaml">{`- id: long-guide
  target: system
  max_tokens: 1200
  file: prompts/long-guide.md`}</Code>
          </Field>
          <Field id="rule-reason" name="reason">
            <p>
              说明规则为什么需要重复投放，只做说明，不注入给模型。{c('inject')} 规则使用 {c('repeat: turn')}、{c('repeat: every')} 或正数 {c('refresh')} 时应写，否则得到 {c('T007')} 警告。
            </p>
            <Code lang="yaml">{`reason: 每次新增 TODO 时提醒补充后续说明。`}</Code>
          </Field>
          <Field id="rule-enabled" name="enabled" def={c('true')}>
            <p>设为 {c('false')} 时规则不安装，但 {c('validate')} 仍然检查它。</p>
            <Code lang="yaml">{`- id: replace-system-example
  enabled: false
  target: system
  mode: replace
  text: 先给结论。`}</Code>
          </Field>

          {/* ---------------- 原生钩子 ---------------- */}
          <H2 id="native-hooks" kicker="04">原生钩子</H2>
          <p>
            原生钩子直接注册作者的命令。STYLE 不渲染模板，不读 {c('defaults')}，不计入预算。
            命令使用 POSIX shell，不支持 Windows，安装时需要用户信任。
          </p>
          <Code lang="yaml">{NATIVE_HOOK_YAML}</Code>

          <H3 id="hook-fields">钩子字段</H3>
          <Field id="hook-id" name="id" req>
            <p>格式规则与<a href="#rule-id">规则 {c('id')}</a> 相同，且不能和本包的规则 {c('id')} 重复。</p>
          </Field>
          <Field id="hook-description" name="description">
            <p>纯文本说明，不做模板处理。只改 {c('description')} 不需要重新审批执行权限。</p>
          </Field>
          <Field id="hook-enabled" name="enabled" def={c('true')}>
            <p>设为 {c('false')} 时不安装。</p>
          </Field>
          <Field id="hook-priority" name="priority" def={<>包级 {c('priority')}，否则 50</>} />
          <Field id="hook-fallback" name="fallback" def={c('skip')}>
            <p>
              只接受 {c('skip')} 和 {c('error')}。某个 harness 映射无法安装时，{c('skip')} 跳过它，{c('error')} 让安装失败。
              没有写映射的 harness 总是跳过，不受 {c('fallback')} 影响。
            </p>
          </Field>

          <H3 id="hook-map">harness 映射</H3>
          <p>
            以 harness 名为键，如 {c('codex')}、{c('claude-code')}，至少写一个。每个映射只接受以下四个字段，{c('async')}、HTTP、MCP、prompt 等扩展字段都会报错。
          </p>
          <Table
            head={['字段', '说明']}
            rows={[
              [c('event'), '必填。harness 的原生事件名，区分大小写。'],
              [c('matcher'), <>只用于工具事件。Codex 使用正则，Claude Code 还接受 {c('*')}。</>],
              [c('command'), <>必填。单行命令，不能以 {c(';')}、{c('&')}、{c('|')}、{c(')')}、{c('#')} 开头。</>],
              [c('timeout'), <>默认 60 秒，范围 1 到 600 秒。Codex 的 {c('SessionEnd')} 最长 3 秒。</>],
            ]}
          />
          <p className="doc-sub">当前适配器支持的原生事件</p>
          <div className="hook-events">
            <div>
              <b>codex</b>
              <p>
                {['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PreCompact', 'PostCompact', 'Stop', 'SubagentStart', 'SubagentStop']
                  .map((e) => <code key={e}>{e}</code>)}
              </p>
            </div>
            <div>
              <b>claude-code</b>
              <p>
                {['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'UserPromptExpansion', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'PostCompact', 'Notification', 'FileChanged']
                  .map((e) => <code key={e}>{e}</code>)}
              </p>
            </div>
          </div>

          {/* ---------------- 单文件包 ---------------- */}
          <H2 id="single-file" kicker="05">单文件包</H2>
          <p>
            只有一条规则时，可以不建目录，写一个 {c('*.style.md')} 文件。frontmatter 同时写包字段和这条规则的字段，正文就是规则正文。
          </p>
          <p>
            单文件包不能声明 {c('rules')}、{c('native_hooks')}、{c('from')}、{c('file')} 和 {c('text')}，省略 {c('id')} 时使用包名。
          </p>
          <Code lang="md" title="lead-with-conclusion.style.md">{SINGLE_FILE_MD}</Code>

          <div className="doc-end">
            <p>规范、示例和源码都在 GitHub。</p>
            <a className="sk-btn" href={REPO_URL} target="_blank" rel="noreferrer">inxups/style-cli ↗</a>
          </div>
        </article>
      </div>
    </>
  )
}

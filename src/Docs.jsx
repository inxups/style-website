import { useEffect, useState } from 'react'
import { REPO_URL } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './home.css'
import './sections.css'
import './docs.css'

const HOME = import.meta.env.BASE_URL

const TOC = [
  { group: '介绍', items: [['what', 'STYLE 是什么'], ['how-it-works', '它怎么工作'], ['status', '现状']] },
  {
    group: '教程',
    items: [
      ['prepare', '0. 准备'],
      ['install-cli', '1. 安装 style'],
      ['init', '2. 创建风格包'],
      ['write-rules', '3. 写规则'],
      ['validate', '4. 校验'],
      ['plan', '5. 预览'],
      ['install', '6. 安装到 agent'],
      ['verify', '7. 看效果'],
      ['iterate', '8. 修改和同步'],
      ['manage', '9. 检查和卸载'],
    ],
  },
  {
    group: '参考',
    items: [
      ['ref-package', '包结构'],
      ['ref-fields', '规则字段'],
      ['ref-targets', '挂载点 target'],
      ['ref-actions', '三种动作'],
      ['ref-when', '条件 when'],
      ['ref-repeat', '去重 repeat'],
      ['ref-template', '模板变量'],
      ['ref-budget', 'token 预算'],
      ['ref-commands', '命令和退出码'],
      ['ref-files', '本地文件'],
    ],
  },
]

const STYLE_YAML = `spec: style/v0.3
name: my-style
version: 0.1.0
description: 先给结论的中文评审风格
vars:
  lang: zh-CN
rules:
  # 常驻约定：没有条件、只用安装时变量，直接写进 agent 的静态指令
  - id: style
    target: system
    file: prompts/default.md

  # 引入一个规则文件
  - from: rules/review.md

  # 工具执行前拦下 force push，子 agent 里也生效
  - id: no-force-push
    target: tool
    tool: shell
    action: block
    when:
      agent: any
      conditions:
        - { field: tool.input.command, op: regex, pattern: 'git\\s+push\\b.*\\s(--force|-f)(\\s|$)' }
    text: 本仓库不允许 force push，请改用新提交。`

const DEFAULT_MD = `本仓库的回复使用 {{vars.lang}}，先给结论，再列依据。`

const REVIEW_MD = `---
target: tool
tool: [file.edit, file.write]
action: warn
when:
  conditions:
    - { field: tool.added, op: contains, pattern: "TODO" }
---
本仓库不在代码里留 TODO 注释。没做完的事请列在回复里，方便跟踪。`

const BAD_OUT = `bad-name STYLE.yaml: name must match ^[a-z0-9][a-z0-9-]{0,63}$
block-after STYLE.yaml#a: block cannot run at after
reads-missing STYLE.yaml#a: model is used but not declared in reads
var-no-default STYLE.yaml#a: model may be empty when unavailable; add a default or a matching when condition`

const PLAN_OUT = `Harness: codex
Preferred route: codex-plugin (availability checked during install)
- style: native (inject system)
  -> static:developer_instructions inject (native)
- review: native (warn tool)
  needs: agent, tool.added
  -> tool.post warn (native); capabilities: add-context, system-message
- no-force-push: native (block tool)
  needs: agent, tool.input.command
  -> tool.pre block (native); capabilities: deny
Token (estimated ≈ ±25%):
  native input limit: 2500 tokens (approximate)
  budget: per_rule 400; per_event 1200; always_on 600 tokens
  always-on: 20 tokens / 26 chars
  PostToolUse apply_patch: 14 tokens / 18 chars
  PreToolUse Bash: 17 tokens / 25 chars
  session cost (requests=60 triggers=3): 143.0 always-on + 250.8 triggered = 393.8 units

Harness: claude-code
- style: native (inject system)
  -> static:claude_md inject (native)
...`

const BLOCK_OUT = `{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "本仓库不允许 force push，请改用新提交。"
  }
}`

const WARN_OUT = `{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "本仓库不在代码里留 TODO 注释。"
  },
  "systemMessage": "本仓库不在代码里留 TODO 注释。没做完的事请列在回复里，方便跟踪。"
}`

const WHEN_YAML = `when:
  model: ["gpt-5*", "**/claude-*"]   # glob，匹配 agent 报告的模型名
  thinking_effort: ">=high"          # 或 high、[minimal, low]、"<=low"
  harness:
    name: [codex, claude-code]
  agent: any                         # 不写 = 只主 agent
  conditions:
    - { field: tool.input.command, op: regex, pattern: '\\bgit\\s+diff\\b' }`

const FILES_TREE = `~/.style/                       # 可用 STYLE_HOME 改
├── style.lock.yaml             # 锁文件：已装的包、文件哈希、路线
├── packages/<name>/            # 安装时复制的包（--link 只记源路径）
├── settings/<name>.yaml        # settings 的值，权限 0600
├── build/index.json            # 编译产物，hook 运行时只读它
├── state/<session>/            # 每个会话的去重记录和计数
├── log/hook.log                # 运行时日志，不记正文和提示词
└── adapters/codex/plugin/      # Codex 插件路线生成的插件`

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
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

const c = (s) => <code>{s}</code>

function useActiveSection() {
  const [active, setActive] = useState('what')
  useEffect(() => {
    // 当前章节 = 最后一个顶边已经过了顶栏下沿的标题
    const els = TOC.flatMap((g) => g.items.map(([id]) => document.getElementById(id))).filter(Boolean)
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
    <div className="toc-group" key={g.group}>
      <span className="toc-title">{g.group}</span>
      {g.items.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'is-active' : ''} onClick={onPick}>{label}</a>
      ))}
    </div>
  ))
}

export default function Docs() {
  const active = useActiveSection()
  const [open, setOpen] = useState(false)

  // 内容由 React 渲染，浏览器加载时找不到锚点，这里补一次跳转
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (!id) return
    const jump = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
    jump()
    document.fonts?.ready.then(jump) // 字体加载后行高会变，再校准一次
  }, [])

  return (
    <>
      <div className="sk-header-wrap is-scrolled">
        <header className="sk-header">
          <a className="sk-logo" href={HOME}><span className="sk-logo-mark"><LogoIcon /></span>STYLE</a>
          <nav className="sk-nav">
            <a href={HOME} className="doc-nav-home">首页</a>
            <a href="#prepare">教程</a>
            <a href="#ref-package" className="doc-nav-ref">参考</a>
            <a className="sk-nav-gh" href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </header>
      </div>

      <section className="doc-hero">
        <span className="sk-ring sk-ring-1" aria-hidden="true" />
        <div className="doc-hero-inner">
          <span className="sec-label">文档 · spec style/v0.3</span>
          <h1>给 Agent 立规矩，<br />从一个 STYLE.yaml 开始。</h1>
          <p>先用几分钟了解 STYLE 是什么，再跟着教程做一个能拦截 force push、能提醒 TODO 的风格包，最后按需查参考。</p>
          <div className="doc-hero-links">
            <a className="sk-btn" href="#prepare">开始教程 →</a>
            <a className="doc-ghost" href="#ref-package">查参考</a>
          </div>
        </div>
      </section>

      <div className="doc-layout">
        <aside className="doc-toc">
          <TocList active={active} />
        </aside>

        <details className="doc-toc-mobile" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary>目录</summary>
          <TocList active={active} onPick={() => setOpen(false)} />
        </details>

        <article className="doc">
          {/* ---------------- 介绍 ---------------- */}
          <H2 id="what" kicker="介绍">STYLE 是什么</H2>
          <p>
            STYLE 是给 coding agent 用的行为微调框架。你把团队约定写成一个<b>风格包</b>：一个 {c('STYLE.yaml')} 加几份 Markdown。
            {c('style')} 命令把它编译好，挂到 agent 自带的 hooks 上。agent 运行到某个时刻（会话开始、提交提示、调用工具前后），
            STYLE 按规则补一句约定、给一句提醒，或者直接拦下这次操作。
          </p>
          <p>
            它不改 agent 本身，也不替换 agent 自带的系统指令。规则是追加在后面的短句。M1 支持 <b>Claude Code</b> 和 <b>Codex</b>，
            同一个包两边都能装，各家的差异由适配器处理。
          </p>
          <ul className="doc-list">
            <li><b>少花 token。</b>注入的文字会留在对话历史里，之后每次请求都要再付一次。所以默认同一会话只注入一次，安装前就能看到 token 估算。</li>
            <li><b>只微调。</b>规则追加在 agent 自带指令后面。要替换内置指令，必须显式加 {c('--allow-replace')}。</li>
            <li><b>做不到就说。</b>某个 agent 不支持的规则按固定顺序降级，每一步都写进报告，不假装生效。</li>
            <li><b>出错放行。</b>hook 出错时默认什么都不做，不会卡住 agent。Claude Code 可以选 {c('--fail-closed')}。</li>
          </ul>

          <H2 id="how-it-works">它怎么工作</H2>
          <ol className="doc-flow">
            <li><b>风格包</b><span>STYLE.yaml + prompts/ + rules/</span></li>
            <li><b>style install</b><span>校验、编译 index.json、写 hook 配置</span></li>
            <li><b>agent 触发 hook</b><span>会话开始、提交提示、调用工具前后</span></li>
            <li><b>style agenthooks run</b><span>只读 index.json，匹配规则</span></li>
            <li><b>注入 · 提醒 · 拦截</b><span>没命中时什么都不输出</span></li>
          </ol>
          <p>
            安装时，STYLE 把规则编译成 {c('~/.style/build/index.json')}，并把 {c('style agenthooks run --provider=<agent>')} 注册成 agent 的 hook。
            之后每次 hook 触发都只读这份编译产物，不读 md、不联网，没命中的规则不花任何 token。
            没有条件的常驻约定不走 hook，直接写进 agent 的静态位置：Codex 的 {c('developer_instructions')}、Claude Code 的 {c('CLAUDE.md')}。
          </p>

          <H2 id="status">现状</H2>
          <Note tone="warn" title="M1 开发中">
            核心、两个适配器和全部 M1 命令已经实现，离线测试通过；在真实 Claude Code / Codex 里的验收（M1b）还没完成。
            目前没有发布二进制，需要从源码构建。规范版本是 {c('style/v0.3')}，字段名以后可能调整。
          </Note>

          {/* ---------------- 教程 ---------------- */}
          <div className="doc-part">
            <span>教程</span>
            <p>下面从零做一个风格包 {c('my-style')}，包含三条规则：回复用中文、先给结论（常驻）；代码里新增 TODO 时提醒（warn）；禁止 {c('git push --force')}（block）。所有命令都在本地实际跑过，输出是真实结果，有删减。</p>
          </div>

          <H2 id="prepare" kicker="教程 · 0">准备</H2>
          <ul className="doc-list">
            <li>Go 1.25 或更高版本。</li>
            <li>Claude Code 或 Codex，至少一个。STYLE 靠 PATH 里的 {c('claude')} / {c('codex')} 命令检测 agent，先确认在终端里能直接运行它们。</li>
          </ul>

          <H2 id="install-cli" kicker="教程 · 1">安装 style</H2>
          <p>克隆仓库，把二进制编译到一个固定位置（下面用 {c('~/.local/bin')}，确保它在 PATH 里）：</p>
          <Code lang="bash" copy>{`git clone https://github.com/inxups/style-cli.git
cd style-cli
go build -o ~/.local/bin/style ./cmd/style`}</Code>
          <Code lang="bash" copy>{`style --help`}</Code>
          <Note title="二进制别乱挪">
            安装风格包后，agent 的 hook 配置里写的是 {c('style')} 的绝对路径。移动或删掉这个文件，hook 就找不到它了；换了位置要重新安装风格包。
          </Note>

          <H2 id="init" kicker="教程 · 2">创建风格包</H2>
          <Code lang="bash" copy>{`style init my-style`}</Code>
          <Code title="生成的目录">{`my-style/
├── STYLE.yaml           # 清单：包信息 + 全部规则
├── prompts/default.md   # 正文文件：只有要注入的文字
└── rules/review.md      # 规则文件：frontmatter + 正文，一个文件一条规则`}</Code>
          <p>
            两种 md 由所在目录区分，不靠内容猜：{c('rules/')} 下的是<b>规则文件</b>，必须有 frontmatter，并且要在 {c('STYLE.yaml')} 里用 {c('from:')} 引入才生效；
            其他位置（习惯放 {c('prompts/')}）是<b>正文文件</b>，不能有 frontmatter，由规则的 {c('file:')} 引用。
          </p>
          <p>只要一条规则的话，可以用 {c('style init quick --single')} 生成单文件包 {c('quick.style.md')}。</p>

          <H2 id="write-rules" kicker="教程 · 3">写规则</H2>
          <p>把 {c('STYLE.yaml')} 改成下面这样：</p>
          <Code lang="yaml" title="my-style/STYLE.yaml">{STYLE_YAML}</Code>
          <Code title="my-style/prompts/default.md">{DEFAULT_MD}</Code>
          <Code lang="md" title="my-style/rules/review.md">{REVIEW_MD}</Code>
          <p>三条规则分别是：</p>
          <ul className="doc-list">
            <li>
              <b>{c('style')}</b>：{c('target: system')}，没有条件，正文只用到安装时就确定的 {c('{{vars.lang}}')}，所以编译时直接渲染成文字，写进 agent 的静态指令，不走 hook，也不会重复花 token。
            </li>
            <li>
              <b>{c('review')}</b>（id 默认取文件路径）：{c('tool: [file.edit, file.write]')} 是工具分类，Claude Code 上对应 {c('Edit')} / {c('Write')}，Codex 上是 {c('apply_patch')}。
              {c('tool.added')} 只看这次<b>新增</b>的行，删掉一行 TODO 不会误报。{c('warn')} 让用户看到全文，模型只看到第一句。
            </li>
            <li>
              <b>{c('no-force-push')}</b>：{c('action: block')} 在工具执行前拦下。规则默认只在主 agent 里生效，{c('agent: any')} 让子 agent 里也拦。拒绝理由每被拦一次就进一次模型上下文，所以要短（超过 40 token 会告警）。
            </li>
          </ul>
          <Note tone="tip" title="写法建议">
            写成事实或约定（“本仓库评审要求每条问题带 file:line”），不要写成命令式的系统指令（“你必须……”、“SYSTEM: ……”），后者容易被 agent 当成可疑的提示词注入。一条规则只说一件事，控制在 100–300 token。
          </Note>

          <H2 id="validate" kicker="教程 · 4">校验</H2>
          <Code lang="bash" copy>{`style validate my-style`}</Code>
          <Code title="输出">{`valid`}</Code>
          <p>写错时，每行一个错误码，后面跟位置和原因。例如包名用了大写、{c('block')} 写了 {c('at: after')}、正文用了没声明的运行时变量：</p>
          <Code title="输出（退出码 1）">{BAD_OUT}</Code>

          <H2 id="plan" kicker="教程 · 5">预览</H2>
          <p>{c('plan')} 只出报告，不改任何文件：每条规则在每个 agent 上落在哪、需要什么能力、要花多少 token。</p>
          <Code lang="bash" copy>{`style plan my-style --harness codex,claude-code`}</Code>
          <Code title="输出（节选）">{PLAN_OUT}</Code>
          <p>
            {c('native')} 表示这个 agent 原生支持；做不到时会写出降级到哪一步。最后一行是按“一个会话 60 次请求、每条规则触发 3 次”估算的会话成本，
            可以用 {c('--assume-requests')}、{c('--assume-triggers')} 调整。
          </p>

          <H2 id="install" kicker="教程 · 6">安装到 agent</H2>
          <Code lang="bash" copy>{`style install my-style --yes`}</Code>
          <Code title="输出（节选）">{`installed my-style 0.1.0
route: codex=codex-plugin`}</Code>
          <p>
            默认装到所有检测到的 agent，用 {c('--harness codex')} 只装一个。安装前会列出这个包会注入什么、会拦什么，等你确认；{c('--yes')} 跳过确认。
            包里有 {c('settings')} 时用 {c('--set key=value')} 赋值。
          </p>
          <Table
            head={['位置', '写了什么']}
            rows={[
              ['Codex', <>{c('hooks.json')}（插件目录或 {c('~/.codex/')}）里的 hook 条目；{c('~/.codex/config.toml')} 里托管的 {c('developer_instructions')}</>],
              ['Claude Code', <>{c('~/.claude/settings.json')} 里的 hook 条目；{c('~/.claude/CLAUDE.md')} 里托管的一段</>],
              ['STYLE 自己', <>{c('~/.style/')}：锁文件、包副本、{c('index.json')}、会话状态、日志</>],
            ]}
          />
          <p>写进 agent 配置的内容都夹在 STYLE 的标记之间，卸载时只删这部分，你自己的配置不动。</p>
          <Table
            head={['agent', '路线', '说明']}
            rows={[
              ['Codex', c('codex-plugin'), '默认首选。以插件形式安装，第一次需要在 Codex 里确认信任'],
              ['Codex', c('codex-user'), <>直接写用户级 {c('~/.codex/hooks.json')}，并预置信任</>],
              ['Claude Code', c('claude-user'), <>写用户级 {c('settings.json')}，新开的会话生效</>],
            ]}
          />
          <p>用 {c('--route codex=codex-user')} 指定路线。</p>

          <H2 id="verify" kicker="教程 · 7">看效果</H2>
          <p>装好后照常使用 agent。下面是把 Codex 的 hook 输入交给 {c('style agenthooks run')} 得到的真实输出（已格式化）。</p>
          <H3>agent 想执行 git push --force origin main</H3>
          <Code lang="json" title="STYLE 返回给 Codex">{BLOCK_OUT}</Code>
          <p>Codex 拒绝执行这条命令，agent 看到拒绝理由，改用别的做法。</p>
          <H3>agent 执行 git push origin main</H3>
          <p>没有规则命中，STYLE 什么都不输出，也不花 token。</p>
          <H3>agent 用 apply_patch 新增了一行 TODO</H3>
          <Code lang="json" title="STYLE 返回给 Codex">{WARN_OUT}</Code>
          <p>{c('additionalContext')} 进模型上下文，只有第一句；{c('systemMessage')} 显示给你看，是全文。</p>
          <Note tone="tip">
            {c('style doctor')} 会列出最近 7 天花 token 最多的规则；运行日志在 {c('~/.style/log/hook.log')}，只记命中了哪条规则，不记提示词和工具参数。
          </Note>

          <H2 id="iterate" kicker="教程 · 8">修改和同步</H2>
          <p>
            普通安装会把包复制到 {c('~/.style/packages/')}，之后改源目录不会自动生效。要更新普通安装的包，先 {c('style uninstall my-style')}，再重新 {c('install')}。
          </p>
          <p>开发时更方便的是 {c('--link')}：只记录源目录，不复制。</p>
          <Code lang="bash" copy>{`style install my-style --link --yes`}</Code>
          <p>改完文件后同步：</p>
          <Code lang="bash" copy>{`style sync`}</Code>
          <Code title="输出（退出码 3）">{`my-style (link=true): 1 changed files
  prompts/default.md
approval required: style trust my-style`}</Code>
          <p>第一次改动会停下，等你看过差异再确认：</p>
          <Code lang="bash" copy>{`style trust my-style`}</Code>
          <p>
            {c('trust')} 会显示源文件和编译结果的差异，确认后写入新的哈希并生效。之后这个 link 包再改，{c('style sync')} 直接同步，只打印改了哪些文件。
            普通（非 link）的包如果被改动，每次 {c('sync')} 都会停下等 {c('trust')}。
          </p>

          <H2 id="manage" kicker="教程 · 9">检查和卸载</H2>
          <Code lang="bash" copy>{`style list               # 已装的包、来源、是否 link、哈希是否一致
style doctor             # 检测 agent 和路线、核对 index、统计 token 花费
style adapters           # 每个 agent 支持哪些能力、上限是多少
style uninstall my-style # 卸载一个包
style uninstall --all    # 全部卸载`}</Code>
          <p>卸载会用剩下的包重新编译；一个都不剩时，删掉 STYLE 写进 agent 配置的全部 hook 条目和静态块。</p>

          {/* ---------------- 参考 ---------------- */}
          <div className="doc-part"><span>参考</span><p>以下内容摘自 STYLE 规范 v0.3。完整规范在仓库的 {c('STYLE_DOCS/')} 目录。</p></div>

          <H2 id="ref-package" kicker="参考">包结构</H2>
          <p>
            {c('STYLE.yaml')} 的 {c('rules[]')} 是包里全部规则的唯一清单：没有自动发现，规则文件不写进 {c('from:')} 就不会生效（validate 会给警告）。
            {c('rules[]')} 的每一项要么是内联规则（写 {c('id')}，再加 {c('file:')} 或 {c('text:')}），要么是 {c('from:')} 引入的规则文件，可以带 glob，也可以覆盖其中的字段（{c('target')} 除外）。
          </p>
          <Code lang="yaml">{`rules:
  - id: base                       # 内联规则
    target: system
    file: prompts/system.md
  - from: rules/tool/no-todo.md    # 引入规则文件
    priority: 10                   # 只覆盖写出来的字段
  - from: rules/legacy.md
    enabled: false                 # 停用，但保留文件
  - from: rules/review/*.md        # glob：引入整个目录`}</Code>
          <p>字段取值从低到高：规范默认值 → 包级 {c('defaults:')} → 规则文件 frontmatter → {c('from:')} 条目上写的字段。覆盖按顶层字段整体替换，{c('reads')} 例外，取并集。</p>
          <Table
            head={['顶层字段', '必填', '说明']}
            rows={[
              [c('spec'), '是', c('style/v0.3')],
              [<>{c('name')} / {c('version')} / {c('description')}</>, '是', <>{c('name')} 只能用小写字母、数字和 {c('-')}；{c('version')} 用 semver</>],
              [c('requires'), '否', <>{c('runtime')}：style 版本范围；{c('harness')}：各 agent 的最低版本</>],
              [c('reads'), '否', '要读的运行时数据（model、thinking_effort、harness.*），不写就是什么都不读'],
              [c('vars'), '否', <>包内常量，模板里写 {c('{{vars.x}}')}</>],
              [c('settings'), '否', <>安装时向用户要的值（{c('name')}、{c('description')}、{c('default')}）</>],
              [c('recommends'), '否', <>建议调整的 agent 设置，例如 {c('codex: { personality: none }')}，只提示不改</>],
              [c('priority'), '否', '默认 50。多条规则同时命中时按它从小到大拼接，越大越靠后'],
              [c('budget'), '否', 'token 预算，见下文'],
              [c('defaults'), '否', '所有规则共用的默认值'],
              [c('rules'), '是', '规则清单，至少一条'],
            ]}
          />

          <H2 id="ref-fields">规则字段</H2>
          <Table
            head={['字段', '默认', '说明']}
            rows={[
              [c('id'), '规则文件取路径', '包内唯一'],
              [c('target'), '必填', 'system / tool / mcp / skill / event / native'],
              [<>{c('file')} / {c('text')}</>, '二选一', '正文，可用模板；规则文件里正文就是文件本身'],
              [c('action'), c('inject'), 'inject / warn / block'],
              [c('at'), c('after'), <>before / after，用于 tool、mcp、skill；{c('block')} 一律在 before</>],
              [c('when'), '无', '条件，全部满足才触发'],
              [c('repeat'), '按动作', 'every / turn / session'],
              [c('model_text'), '正文第一句', <>只对 {c('warn')} 有效：给模型的那一句</>],
              [c('reinject_on_compact'), <>system 为 {c('true')}</>, '上下文压缩后要不要补发'],
              [c('sources'), c('[startup, clear, fork]'), '挂在会话开始的规则在哪些来源上触发'],
              [c('fallback'), c('degrade'), 'agent 做不到时：degrade 降级 / skip 跳过 / error 拒绝安装'],
              [c('priority'), '继承包级', ''],
              [c('max_tokens'), c('budget.per_rule'), '这条规则的 token 上限'],
              [c('reason'), '无', '说明为什么要重复注入，只用来消掉 T007'],
              [c('enabled'), c('true'), <>{c('false')} 停用</>],
            ]}
          />

          <H2 id="ref-targets">挂载点 target</H2>
          <Table
            head={['target', '写法', '挂在哪']}
            rows={[
              [c('system'), <>{c('mode: append')}（默认）或 {c('replace')}</>, '静态正文、无条件 → 写进静态位置；否则在会话开始注入，并在每条提示上重新评估'],
              [c('tool'), <>{c('tool:')} 工具分类，或 {c('names:')} 原生工具名</>, <>{c('at: before')} → 工具执行前；{c('after')} → 工具执行后</>],
              [c('mcp'), c('mcp: "server/tool"'), <>同 tool；支持 {c('server/*')}、{c('*/tool')}</>],
              [c('skill'), c('skill: code-review'), <>模型自己用 skill 时按 {c('at')} 挂在工具前后；用户点名（{c('/name')}、{c('$name')}）时单独触发</>],
              [c('event'), c('event: prompt.submitted'), <>{c('session.start')}、{c('prompt.submitted')}、{c('tool.pre')}、{c('tool.post')}、{c('tool.error')}（仅 Claude）、{c('subagent.start')}</>],
              [c('native'), '以 agent 名为键写原生 hook', 'M2 实现；M1 校验通过，plan 报“跳过（M2）”'],
            ]}
          />
          <Table
            head={['工具分类', 'Claude Code', 'Codex']}
            rows={[
              [c('shell'), c('Bash'), c('Bash')],
              [c('file.edit'), c('Edit'), <>{c('apply_patch')}（新建文件也走它）</>],
              [c('file.write'), c('Write'), '永不触发，已归到 file.edit'],
              [c('file.read'), c('Read'), '永不触发'],
              [c('search'), <>{c('Grep')}、{c('Glob')}</>, '永不触发'],
              [c('fetch'), c('WebFetch'), '永不触发'],
              [c('task'), c('Agent'), '永不触发'],
            ]}
          />

          <H2 id="ref-actions">三种动作</H2>
          <Table
            head={['动作', '进模型上下文（花 token）', '给用户看', '默认 repeat']}
            rows={[
              [c('inject'), '正文', '—', c('session')],
              [c('warn'), <>{c('model_text')}，默认是正文第一句</>, '正文全文', c('every')],
              [<>{c('block')}（工具调用）</>, '拒绝理由', '拒绝理由', '不去重'],
              [<>{c('block')}（提示词）</>, '—', '拒绝理由', '不去重'],
            ]}
          />
          <p>
            {c('block')} 只能用在 tool、mcp、skill，或 {c('event: tool.pre')} / {c('prompt.submitted')}。同一次 hook 调用里有 {c('block')} 命中时，只输出拒绝，其他注入都不发。
            多条规则同时命中时，按 {c('priority')} 排好，用空行拼成一段，不加任何标题或外壳。
          </p>

          <H2 id="ref-when">条件 when</H2>
          <Code lang="yaml">{WHEN_YAML}</Code>
          <ul className="doc-list">
            <li>同一字段的多个值是“或”，不同字段之间是“且”，全部满足才触发。</li>
            <li><b>取不到就不满足</b>：这次拿不到需要的数据，规则就不触发。</li>
            <li>{c('model')}、{c('thinking_effort')}、{c('harness.*')} 要先在 {c('reads')} 里声明。</li>
            <li>{c('thinking_effort')} 有七档：{c('none < minimal < low < medium < high < xhigh < max')}。Codex 上只有配置了 {c('model_reasoning_effort')} 才有值。</li>
            <li>{c('agent')} 不写时只在主 agent 生效；{c('any')} 包括所有子 agent；也可以列子 agent 的类型名。</li>
          </ul>
          <Table
            head={['conditions 字段', '内容']}
            rows={[
              [c('prompt'), '用户提示原文'],
              [<>{c('tool.name')} / {c('tool.canonical')}</>, '原生工具名 / 工具分类'],
              [<>{c('tool.input')} / {c('tool.input.<路径>')}</>, '整个工具输入 / 输入里的某个字段'],
              [c('tool.added'), '这次改动新增的文本，只在 file.edit / file.write 上有'],
              [c('tool.output'), '工具输出，只在工具执行后有'],
              [<>{c('mcp.server')} / {c('mcp.tool')}</>, 'MCP 服务名和工具名'],
              [c('skill.name'), 'skill 名'],
              [c('cwd'), '工作目录'],
            ]}
          />
          <p>{c('op')} 可选：{c('regex')}（RE2）、{c('contains')}、{c('not_contains')}、{c('equals')}、{c('starts_with')}、{c('ends_with')}。</p>

          <H2 id="ref-repeat">去重 repeat</H2>
          <Table
            head={['repeat', '效果']}
            rows={[
              [c('every'), '每次命中都输出'],
              [c('turn'), '同一回合、同样内容只输出一次'],
              [c('session'), '同一会话、同样内容只输出一次'],
            ]}
          />
          <ul className="doc-list">
            <li>“同样内容”按渲染后的正文判断：正文里的模型名变了，就会再注入一次。</li>
            <li>{c('/clear')} 之后去重记录作废。上下文压缩后，只有 {c('reinject_on_compact: true')} 的规则（system 默认是）会补发。</li>
            <li>恢复会话（resume）默认不重新注入；子 agent 有自己的去重记录。</li>
            <li>{c('inject')} 写 {c('turn')} / {c('every')} 又没写 {c('reason:')} 时，lint T007 告警。</li>
          </ul>

          <H2 id="ref-template">模板变量</H2>
          <p>语法只有替换：{c('{{name}}')} 和带默认值的 {c('{{name | default: "未知"}}')}，没有分支和循环。条件不同、文字不同，就拆成两条规则。</p>
          <Table
            head={['变量', '何时确定', '说明']}
            rows={[
              [<>{c('vars.*')}、{c('settings.*')}、{c('package.name')}、{c('package.version')}、{c('rule.id')}</>, '安装时', '编译时直接渲染'],
              [<>{c('model')}、{c('thinking_effort')}、{c('thinking_effort_raw')}</>, '运行时', <>要在 {c('reads')} 里声明，建议写 default</>],
              [<>{c('harness.name')}、{c('harness.cwd')}、{c('harness.agent')} 等</>, '运行时', <>要在 {c('reads.harness')} 里声明</>],
              [<>{c('prompt')}、{c('tool.*')}、{c('mcp.*')}、{c('skill.name')}</>, '—', <>M1 不能进模板，只能写在 {c('when.conditions')} 里</>],
            ]}
          />

          <H2 id="ref-budget">token 预算</H2>
          <Code lang="yaml">{`budget:            # 不写就是这些默认值
  per_rule: 400    # 单条规则给模型的文字
  per_event: 1200  # 本包在同一个 hook 事件上最坏情况的合计
  always_on: 600   # 本包的常驻部分
  on: warn         # T001/T002/T004 的严重程度：warn | error`}</Code>
          <Table
            head={['编码', '含义', '级别']}
            rows={[
              ['T001', '单条规则超 per_rule', '跟 budget.on'],
              ['T002', '本包同一事件合计超 per_event', '跟 budget.on'],
              ['T003', '所有已装包在同一事件上超过 agent 上限的 80%（Claude 8,000 字符、Codex 2,000 token）', '错误，安装中止'],
              ['T004', '常驻部分超 always_on', '跟 budget.on'],
              ['T005', 'block 理由超过 40 token', '警告'],
              ['T006', '模板用了每次都变的变量（session_id、turn_id）', '警告'],
              ['T007', 'inject 重复注入又没写 reason', '警告'],
            ]}
          />
          <p>估算误差约 ±25%。中文大约一字一 token，不一定比英文省，以 {c('style plan')} 的估算为准。</p>

          <H2 id="ref-commands">命令和退出码</H2>
          <Table
            wrap
            head={['命令', '作用']}
            rows={[
              [c('style init [name] [--single]'), '生成包骨架'],
              [c('style validate [path]'), '校验包，输出错误码和 lint'],
              [c('style plan <源> [--harness …]'), '只出报告：规则落点、降级、token 估算'],
              [c('style install <源> [--harness h] [--route h=r] [--set k=v] [--link] [--yes]'), '安装'],
              [c('style uninstall <name> | --all'), '卸载'],
              [c('style list'), '已装的包'],
              [c('style sync'), '重新编译；有未确认的改动时停下'],
              [c('style trust <name>'), '查看差异并确认改动'],
              [c('style doctor [--reset-state]'), '健康检查、token 花费排行；可清空会话状态'],
              [c('style adapters'), 'agent 能力、路线、上限'],
            ]}
          />
          <p>所有命令都支持 {c('--json')}。其他选项：{c('--allow-replace')} 允许 {c('mode: replace')}；{c('--fail-closed claude-code')} 让 hook 出错时拦下工具调用。</p>
          <Table
            head={['退出码', '含义']}
            rows={[
              ['0', '成功'],
              ['1', '校验失败或用法错误'],
              ['3', <>{c('sync')} 发现改动，需要 {c('trust')}</>],
              ['4', <>安装中止（{c('fallback: error')} 命中，或 T003）</>],
            ]}
          />

          <H2 id="ref-files">本地文件</H2>
          <Code>{FILES_TREE}</Code>
          <p>会话状态 7 天没更新会在 {c('sync')} 和 {c('doctor')} 时清理；hook 运行时不做清理，不扫目录，不联网。</p>

          <div className="doc-end">
            <p>规范、设计文档和源码都在 GitHub。</p>
            <a className="sk-btn" href={REPO_URL} target="_blank" rel="noreferrer">inxups/style-cli ↗</a>
          </div>
        </article>
      </div>
    </>
  )
}

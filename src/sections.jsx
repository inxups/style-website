import { useState } from 'react'
import { DOCS_URL, REPO_URL, SKILLS_REPO_URL } from './shared.js'
import LogoIcon from './LogoIcon.jsx'
import Code from './Code.jsx'
import './sections.css'

const ACTION_COLOR = { inject: '#c9f2e1', warn: '#fff0a6', block: '#ffcfc2' }

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

// 两个 STYLE 相关的 agent skill，源文件在 inxv-skills 仓库，网站只做介绍和安装入口
const SKILLS = [
  {
    name: 'style-creator',
    title: '编写规则包',
    desc: '把你的约定写成 STYLE 包：先确认包名、路径、目标 harness 和规则行为，再生成文件，最后用 validate 和 plan 校验。',
    prompt: '帮我写一个 STYLE 包：禁止 git push --force，提示新增的 TODO。',
    color: '#e4dbff',
  },
  {
    name: 'style-installer',
    title: '安装与维护',
    desc: '安装、link、更新、同步、恢复或卸载 STYLE 包：先 validate 和 plan 预览，确认后执行，再用 list 核对结果。',
    prompt: '把 ./my-style 安装到当前项目的 Claude Code 和 Codex。',
    color: '#d3e4ff',
  },
]

// 各 harness 读取用户级 skill 的目录
const SKILL_DIRS = { 'Claude Code': '~/.claude/skills', Codex: '~/.agents/skills' }

const installCmd = (dir) => `git clone --depth 1 ${SKILLS_REPO_URL}.git /tmp/inxv-skills
mkdir -p ${dir}
cp -R /tmp/inxv-skills/style-creator /tmp/inxv-skills/style-installer ${dir}/`

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
    <section className="sec sec-mist" id="start">
      <div className="sec-inner">
        <SectionHead title="什么是 STYLE" sub="通过几行规则调整 Claude Code、Codex 等 harness 的行为，使其符合你的使用习惯。" />
        <div className="steps">
          <article className="step" data-reveal>
            <span className="step-tag" style={{ background: ACTION_COLOR.warn }}>warn</span>
            <h3>提示新增 TODO</h3>
            <p>代码改动中新增 TODO 时，向用户显示完整提示，并将首句传给 Agent。</p>
            <Code lang="md" title="rules/no-todo.md">{NO_TODO}</Code>
          </article>
          <article className="step" data-reveal>
            <span className="step-tag" style={{ background: ACTION_COLOR.block }}>block</span>
            <h3>阻止 force push</h3>
            <p>Agent 执行 git push --force 时，拒绝该调用，并以规则正文作为拒绝理由。</p>
            <Code lang="md" title="rules/no-force-push.md">{NO_FORCE_PUSH}</Code>
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

export function Skills() {
  const [harness, setHarness] = useState('Claude Code')
  return (
    <section className="sec" id="skills">
      <div className="sec-inner">
        <SectionHead title="交给 Agent 来写" sub="装上两个 skill，直接用自然语言让 Agent 编写、校验和安装 STYLE 包。" />
        <div className="skills">
          {SKILLS.map((s) => (
            <article className="step skill" key={s.name} data-reveal>
              <span className="step-tag" style={{ background: s.color }}>{s.name}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <blockquote className="skill-prompt">{s.prompt}</blockquote>
              <a className="skill-link" href={`${SKILLS_REPO_URL}/blob/main/${s.name}/SKILL.md`} target="_blank" rel="noreferrer">查看 SKILL.md ↗</a>
            </article>
          ))}
        </div>
        <div className="skill-install" data-reveal>
          <div className="skill-tabs" role="tablist">
            {Object.keys(SKILL_DIRS).map((h) => (
              <button key={h} role="tab" aria-selected={h === harness} onClick={() => setHarness(h)}>{h}</button>
            ))}
          </div>
          <Code lang="bash" title={`安装到 ${SKILL_DIRS[harness]}`} copy>{installCmd(SKILL_DIRS[harness])}</Code>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="foot-bar">
        <a className="foot-logo" href="#top"><span className="foot-mark"><LogoIcon size={20} /></span>STYLE</a>
        <span className="foot-note">支持 Claude Code · Codex</span>
        <nav>
          <a href={DOCS_URL}>文档</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}

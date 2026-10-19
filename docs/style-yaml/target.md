---
title: target：规则作用对象
scope: rule
keys: [target, tool, names, mcp, skill, event, sources, mode]
spec: style/v0.3
sources:
  - core/spec/validate_rules.go
  - core/spec/validate_conditions.go
  - core/spec/merge.go
  - core/plan/requirements.go
  - core/plan/events.go
  - core/plan/system.go
  - core/compile/entries.go
  - core/engine/match.go
  - agenthooks/event.go
  - internal/app/install.go
  - internal/adapter/claude/runtime.go
---

# target：规则作用对象

> `target` 决定规则在什么时候生效：整个会话、某类工具调用、某个 MCP 工具、某个 skill，或某个具体事件。

## 概览

每条规则都必须声明 `target`。不同的 `target` 需要不同的选择器字段：

| `target` | 生效时机 | 选择器 | 评估点（事件） |
|---|---|---|---|
| `system` | 整个会话 | — | 静态指令位置，或 `session.start` + `prompt.submitted` |
| `tool` | 工具调用 | `tool`、`names`（至少一个） | `tool.post`（默认）或 `tool.pre` |
| `mcp` | MCP 工具调用 | `mcp` | `tool.post`（默认）或 `tool.pre` |
| `skill` | 使用 skill | `skill` | `tool.post` / `tool.pre`，以及 `skill.explicit` |
| `event` | 指定事件 | `event` | `event` 指定的事件 |

`tool`、`mcp`、`skill` 在调用前还是调用后生效由 `at` 决定，见 [action.md](action.md)。

```yaml
rules:
  - { id: a, target: system, text: ... }
  - { id: b, target: tool, tool: shell, text: ... }
  - { id: c, target: mcp, mcp: github/*, text: ... }
  - { id: d, target: skill, skill: release, text: ... }
  - { id: e, target: event, event: prompt.submitted, text: ... }
```

## 字段

### `target`

| 属性 | 值 |
|---|---|
| 位置 | 规则 |
| 类型 | string |
| 必填 | 是 |
| 默认值 | 无 |
| 可选值 | `system` / `tool` / `mcp` / `skill` / `event` |
| 可写入 defaults | 否 |

约束：

- 必须声明，且取上述值之一（诊断码 `invalid-schema`）。
- `from` 条目不能覆盖规则文件的 `target`（诊断码 `override-target`）。
- 旧版的 `target: native` 已移除，原生 hook 改用 `native_hooks` 声明（诊断码 `native-format-removed`）。

### `tool`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: tool`） |
| 类型 | string \| string[] |
| 必填 | `tool` 和 `names` 至少一个 |
| 默认值 | 无 |
| 可选值 | `shell` / `file.read` / `file.write` / `file.edit` / `search` / `fetch` / `task` / `mcp` / `other` / `*` |
| 可写入 defaults | 否 |

跨 harness 的规范工具分类（canonical tool）。STYLE 把各 harness 的原生工具名归入这些类别，例如 Claude Code 和 Codex 的 `Bash` 工具都归入 `shell`。`*` 匹配所有工具。

> `tool` 的取值不做校验。把原生名写进 `tool`（例如 `tool: Bash`）不会报错，在 Claude Code 上计划也显示 `native`，但运行时永远不会匹配，因为它只和规范分类比较。原生名要写在 `names` 里。

约束：

- 不能为空列表，每个值不能为空或带首尾空白（诊断码 `invalid-schema`）。

### `names`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: tool`） |
| 类型 | string \| string[] |
| 必填 | `tool` 和 `names` 至少一个 |
| 默认值 | 无 |
| 可选值 | harness 原生工具名，或 `*` |
| 可写入 defaults | 否 |

按 harness 原生工具名匹配，不区分大小写，例如 `Read`、`apply_patch`。`tool` 和 `names` 同时声明时，命中任意一个即可。

约束：同 `tool`。

### `mcp`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: mcp`） |
| 类型 | string \| string[] |
| 必填 | `target: mcp` 时必填 |
| 默认值 | 无 |
| 可选值 | `server/tool` 格式 |
| 可写入 defaults | 否 |

MCP 工具选择器。`server` 和 `tool` 都可以写 `*`，例如 `github/*` 匹配 github 服务器的所有工具，`*/search` 匹配所有服务器上名为 search 的工具。

约束：

- 必须是 `server/tool` 格式，两部分都非空，`tool` 中不能再有 `/`（诊断码 `invalid-schema`）。

### `skill`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: skill`） |
| 类型 | string \| string[] |
| 必填 | `target: skill` 时必填 |
| 默认值 | 无 |
| 可选值 | skill 名称，或 `*` |
| 可写入 defaults | 否 |

skill 名称，不区分大小写。skill 规则有两个评估点：模型在对话中使用 skill 时触发的工具事件，以及用户显式调用 skill 时的 `skill.explicit`。两者能观察到的 skill 范围因 harness 而异，例如 Codex 只观察显式的 `$name` 调用和本地 SKILL.md 的读取。

### `event`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: event`） |
| 类型 | string |
| 必填 | `target: event` 时必填 |
| 默认值 | 无 |
| 可选值 | `session.start` / `prompt.submitted` / `tool.pre` / `tool.post` / `tool.error` / `subagent.start` |
| 可写入 defaults | 否 |

| 事件 | 触发时机 |
|---|---|
| `session.start` | 会话开始，由 `sources` 筛选来源 |
| `prompt.submitted` | 用户提交提示 |
| `tool.pre` | 任意工具调用前 |
| `tool.post` | 任意工具调用结束后，失败的调用也会触发（见下文"失败与中断"） |
| `tool.error` | 任意工具调用失败后（只有 Claude Code 支持） |
| `subagent.start` | 子代理启动 |

约束：

- 必须是上表中的事件（诊断码 `invalid-schema`）。

### `sources`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: system`，或 `event: session.start`） |
| 类型 | string \| string[] |
| 必填 | 否 |
| 默认值 | `[startup, clear, fork]` |
| 可选值 | harness 报告的会话来源，如 `startup`、`resume`、`clear`、`compact`、`fork` |
| 可写入 defaults | 是 |

只在 `session.start` 上生效：只有会话来源在列表中时，规则才会注入。`reinject_on_compact: true` 会自动加入 `compact`。

约束：

- 声明在不经过 `session.start` 的规则上会报警告（诊断码 `sources-unused`）。

### `mode`

| 属性 | 值 |
|---|---|
| 位置 | 规则（`target: system`） |
| 类型 | string |
| 必填 | 否 |
| 默认值 | system 规则为 `append` |
| 可选值 | `append` / `replace` |
| 可写入 defaults | 否 |

- `append`：追加到 harness 的指令中。
- `replace`：替换 harness 的静态指令。只能用于静态 system 规则，不能降级到 hook。当前 Codex 和 Claude Code 都没有可替换的静态位置，这样的规则会被跳过或报安装错误。

约束：

- 只能用于 `target: system`（诊断码 `replace-non-system`）。

## 行为

1. **system 规则**：静态正文（inject、无运行时变量、无 `when`、`refresh` 为 0）写入 harness 的静态指令位置，例如 Codex 的 `developer_instructions`、Claude Code 的 `claude_rules`。其他 system 规则挂在 `session.start` 和 `prompt.submitted` 上（`core/plan/system.go`）。
2. **选择器匹配**：运行时先按选择器筛选，再评估 `when`。`tool` 按规范分类精确匹配，`names` 和 `skill` 不区分大小写（`core/engine/match.go` `matchesTarget`）。
3. **harness 盲区**：有些 harness 只订阅固定的工具。例如 Codex 只观察 `shell`、`file.edit`、`mcp`、`*` 这几个规范分类，以及 `Bash`、`apply_patch`、`mcp__*` 原生名。选择器都不在其中时，计划结果为 `never-trigger`。
4. **事件能力因 harness 而异**：本机 Codex 0.159.3 和 Claude Code 2.1.301 的能力如下（`style doctor` 查看）：

| 事件 | Codex | Claude Code |
|---|---|---|
| `session.start` | add-context | add-context、system-message |
| `prompt.submitted` | add-context、system-message、deny | add-context、system-message、deny |
| `skill.explicit` | add-context、system-message、deny | add-context、system-message、deny |
| `tool.pre` | add-context、system-message、deny | add-context、system-message、deny |
| `tool.post` | add-context、system-message | add-context、system-message |
| `tool.error` | 无 | add-context、system-message |
| `subagent.start` | add-context | 无 |

缺少能力时怎么处理，见 [fallback.md](fallback.md)。

5. **失败与中断**：两个 harness 报告失败的方式不同。

| 情况 | Codex | Claude Code |
|---|---|---|
| 工具调用失败 | 和成功一样走 PostToolUse，只触发 `tool.post`；没有退出码 | 走 PostToolUseFailure，同时触发 `tool.error` 和 `tool.post`。安装 `tool.post` 规则时会一并订阅 PostToolUseFailure（`internal/app/install.go` `hooksForProvider`） |
| 用户按 Esc 中断 | 未验证 | 不触发任何 hook，`tool.post` 和 `tool.error` 规则都不会运行 |
| 失败事件带 `is_interrupt: true` | — | 只触发 `tool.error`，不触发 `tool.post`（`internal/adapter/claude/runtime.go`） |

- 想区分成功和失败，在 Claude Code 上用 `tool.error` 单独匹配失败；在 Codex 上只能用 `tool.post` 规则匹配输出文本（例如 `command not found`），没法按退出码判断。
- 已安装的包要运行一次 `style sync`，才会补上 PostToolUseFailure 订阅；在那之前 `style doctor` 会报 route drift。

## 示例

### 最小示例

```yaml
spec: style/v0.3
name: tg-min
version: 0.1.0
description: target minimal example
rules:
  - id: shell-tips
    target: tool
    tool: shell
    text: Prefer rg over grep.
```

### 各类目标

```yaml
spec: style/v0.3
name: tg-all
version: 0.1.0
description: targets example
rules:
  - id: house-style
    target: system
    text: Answer in English.
  - id: read-tips
    target: tool
    tool: file.read
    names: [Read]
    text: Read only the lines you need.
  - id: github-tips
    target: mcp
    mcp: github/*
    text: Link issues by number.
  - id: release-skill
    target: skill
    skill: release
    text: Bump the version before tagging.
  - id: resume-note
    target: event
    event: session.start
    sources: [resume]
    text: Re-read the open task list.
```

`style plan tg-all --harness codex,claude-code` 的结果（节选）：

```text
Harness: codex
- house-style: native (inject system)
  -> static:developer_instructions inject (native)
- read-tips: never-trigger (inject tool)
  ! Codex fixed subscription does not observe these tool selectors
- release-skill: native (inject skill)
  -> tool.post inject (native); capabilities: add-context
  -> skill.explicit inject (native); capabilities: add-context
Harness: claude-code
- read-tips: native (inject tool)
  -> tool.post inject (native); capabilities: add-context
```

Codex 不观察 `file.read` 和 `Read`，所以 `read-tips` 在 Codex 上不会触发。

## 选择建议

| 需求 | 推荐写法 |
|---|---|
| 特定工具调用前后 | `target: tool` + `tool` / `names` |
| 特定 MCP 工具 | `target: mcp` |
| 所有工具调用前后 | `target: tool` + `tool: "*"`；条件要用 `mcp.*`，或要对所有工具用 `tool.added` 时，改用 `target: event` |
| 会话、提示、工具失败、子代理 | `target: event` |

1. **针对特定工具，用选择器，不用 `event` + `when`。** `target: event` 的规则没有选择器，在 Claude Code 上装成空 matcher，每次工具调用都会启动 hook，再由运行时的 `when` 丢弃（`internal/app/install.go` `hooksForProvider`、`core/engine/match.go` `matchesTarget`）。`style plan` 的 token 统计里，`target: tool` + `tool: shell` 计入 `PreToolUse Bash`，`event: tool.pre` + `tool.canonical` 条件计入 `PreToolUse *`；`target: mcp` 计入 `PreToolUse mcp`，`event` + `mcp.tool` 条件同样计入 `PreToolUse *`。
2. **需要降级时，用 `tool` / `mcp` / `skill`。** `fallback: degrade` 下，这三类规则的首选事件不可用时，会改挂另一侧（`tool.pre` ↔ `tool.post`，block 规则除外）；没有 `when` 的静态正文还能退成静态指令。`target: event` 只有一个评估点，没有这两条退路（`core/plan/requirements.go` `eventFor`、`core/plan/events.go`）。
3. **匹配所有工具时，两种写法各有限制。** `tool: "*"` 和 `event: tool.pre` 安装结果相同，前者保留降级路径。但 `target: tool` 只在选中 `file.edit`、`file.write` 或使用 `names` 时提供 `tool.added`，也不提供 `mcp.*`；`event: tool.pre` / `tool.post` 两者都可用（`core/spec/validate_conditions.go` `conditionFieldAvailable`）。
4. **拦截规则只写在能直接拒绝的位置。** `action: block` 用 `target: tool` / `mcp` / `skill`（规则和 `defaults` 都未写 `at` 时默认 `before`），或 `event: tool.pre` / `prompt.submitted`；`fail: closed` 同理。详见 [action.md](action.md)。
5. **依赖 `tool.output` 的规则，显式写 `at: after`。** 未写 `at` 时会继承 `defaults.at`；包级 `defaults.at: before` 会让规则落到 `tool.pre`，那里没有工具输出，校验报 `condition-field-wrong-event`（`core/spec/merge.go`、`core/spec/validate_conditions.go`）。

推荐写法：

```yaml
spec: style/v0.3
name: tg-choose
version: 0.1.0
description: choose tool or event
rules:
  - id: shell-before
    target: tool
    tool: shell
    at: before
    text: Check the command for side effects.
  - id: any-tool-before
    target: event
    event: tool.pre
    text: Stay inside the working directory.
  - id: guard-rm
    target: tool
    tool: shell
    action: block
    text: Do not run rm -rf.
    when:
      conditions:
        - {field: tool.input.command, op: contains, pattern: rm -rf}
  - id: shell-failed
    target: tool
    tool: shell
    at: after
    text: Read the error before retrying.
    when:
      conditions:
        - {field: tool.output, op: contains, pattern: command not found}
  - id: pr-tips
    target: mcp
    mcp: github/create_pull_request
    at: before
    text: Link the issue in the PR body.
```

`style plan tg-choose --harness claude-code` 的 token 统计（节选）：

```text
  PostToolUse Bash: 9 tokens / 31 chars
  PostToolUseFailure Bash: 9 tokens / 31 chars
  PreToolUse *: 10 tokens / 34 chars
  PreToolUse Bash: 11 tokens / 35 chars
  PreToolUse mcp: 10 tokens / 30 chars
```

只有 `any-tool-before` 挂在 `*` 上。反例：`defaults.at: before` 让依赖输出的规则失效。

```yaml
spec: style/v0.3
name: tg-pitfall
version: 0.1.0
description: defaults at before breaks tool.output
defaults:
  at: before
rules:
  - id: shell-failed
    target: tool
    tool: shell
    text: Read the error before retrying.
    when:
      conditions:
        - {field: tool.output, op: contains, pattern: command not found}
```

`style validate` 报 `condition-field-wrong-event`；在规则上写 `at: after` 后通过。

## 校验与诊断

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `invalid-schema` | error | 缺少或写错 `target`；缺少对应的选择器；选择器为空、带空白或格式错误；未知事件 |
| `override-target` | error | `from` 条目覆盖 `target` |
| `replace-non-system` | error | 非 system 规则使用 `mode: replace` |
| `native-format-removed` | error | 使用了已移除的 `target: native` |
| `sources-unused` | warning | `sources` 声明在不经过 `session.start` 的规则上 |

## 相关

- [action：动作与时机](action.md)（`at`）
- [when：条件匹配](when.md)
- [fallback：落点不可用时的处理](fallback.md)
- [native_hooks：原生 hook](native-hooks.md)

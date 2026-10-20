---
title: 写作与测试：从校验到重放事件
scope: concept
keys: []
spec: style/v0.3
sources:
  - internal/app/project.go
  - internal/app/explain.go
  - internal/app/explain_command.go
  - core/engine/process.go
  - internal/adapter/codex/runtime.go
  - internal/adapter/claude/runtime.go
  - agenthooks/codec_claudecode.go
  - agenthooks/codec_codex.go
---

# 写作与测试：从校验到重放事件

> 写完规则后，怎么在不影响真实环境的前提下，确认它在 Codex 和 Claude Code 上按预期匹配、去重和输出。

## 概览

`style validate` 只检查格式，`style plan` 只说明规则落在哪个事件上，这两步都不能证明规则在运行时会命中。`style explain` 用一份 harness 事件 payload 重放运行时，列出每条规则在匹配各阶段的结果，以及最终写回 harness 的内容。

`explain` 读取的是已安装的运行时索引，所以要先安装一次。把 STYLE 主目录、项目目录和 harness 用户配置目录都放到临时目录里，就能完整走一遍安装和重放，不改动真实环境。

| 步骤 | 命令 | 能确认什么 |
|---|---|---|
| 1. 校验 | `style validate` | 字段、选择器、条件、模板变量是否合法 |
| 2. 看计划 | `style plan --harness codex,claude-code` | 每个 harness 上的落点、状态（`native` / `degraded` / `never-trigger` / `skipped`）和 token 估算 |
| 3. 隔离安装 | `style --project ... --style-home ... link ...` | 编译出运行时索引，生成项目级 hook 配置 |
| 4. 重放事件 | `style explain --payload ...` | 选择器、`when`、去重、block 和输出是否符合预期 |
| 5. 修改后同步 | `style sync` | 链接包的普通规则修改直接生效，再回到第 4 步 |

## 行为

1. **隔离环境**：项目级安装把 hook 配置写进项目目录（`.codex/hooks.json`、`.claude/settings.json`），状态写进 `--style-home`。如果 harness 的用户配置目录里已经有另一个 STYLE 主目录的安装，项目级安装会以 `project-binding-invalid` 拒绝（"harness has a user STYLE owner outside this base home"）。所以测试时还要把 `CODEX_HOME` 和 `CLAUDE_CONFIG_DIR` 指向临时目录（`internal/app/project.go`）。另外两条限制：项目目录和 STYLE 主目录不能互相包含；项目目录不能位于 harness 用户配置目录内。
2. **链接安装**：`style link` 直接引用源码目录。第一次 `style sync` 会提示审批快照，之后修改普通规则只需 `style sync`，不再提示。修改 `native_hooks` 后 `sync` 会再次提示审批，见 [cli.md](cli.md#sync)。
3. **payload**：必须包含 `hook_event_name` 和 `session_id`，字段名和 harness 发给 hook 的原生 JSON 一致。两个 harness 的主要区别如下：

| 内容 | Claude Code | Codex |
|---|---|---|
| shell 输入 | `"tool_name":"Bash","tool_input":{"command":"..."}` | 相同 |
| 工具输出 | `tool_response` 是对象，例如 `{"stdout":"...","stderr":"..."}` | `tool_response` 是字符串 |
| MCP 调用 | `"tool_name":"mcp__github__create_pull_request"`，可带 `"mcp_server":{"name":"github"}` | 相同 |
| 轮次 id（`repeat: turn` 用） | `prompt_id` | `turn_id` |

4. **trace 字段**：`explain` 对每条候选规则输出一行 `entry`，按阶段列出结果。前一阶段没通过时，后面的阶段都是 `not-evaluated`（`core/engine/process.go` `Process`）。

| 阶段 | 取值 | 含义 |
|---|---|---|
| `selector` | `pass` / `target-mismatch` | 选择器是否匹配这次调用 |
| `sources` | `pass` / `source-mismatch` | `session.start` 的来源是否在 `sources` 中 |
| `when` | `pass` / `predicate-false` / `missing-data` | 条件成立 / 不成立 / 需要的数据不可用 |
| `render` | `pass` / `empty-render` | 正文是否渲染出内容 |
| `block` | `pass` / `blocked` / `block-precedence` | 未拦截 / 本条拦截 / 被其他 block 压下，见 [action.md](action.md) |
| `repeat` | `claimed` / `repeat-seen` / `repeat-bypass` | 登记并输出 / 已输出过被去重 / block 不去重 |
| `output` | `output` / `blocked` / `cap-drop` | 输出 / 作为拒绝理由输出 / 合计超过 harness 输入上限，按顺序从最后一条起丢弃 |

最后的 `wire stdout`、`wire stderr`、`wire exit_code` 是写回 harness 的原始内容。同一事件的多条 inject 输出用空行拼接。

5. **状态**：`explain` 只读，不写会话状态，每次都从空状态开始，所以 `repeat` 总显示第一次命中的结果。要模拟已有会话，用 `--state-dir` 指向真实的状态目录。payload 里没有的模型、effort 等事实用 `--facts` 补充，见 [cli.md](cli.md)。

## 示例

### 最小示例

被测的包：

```yaml
spec: style/v0.3
name: au-demo
version: 0.1.0
description: authoring test example
rules:
  - id: guard-rm
    target: tool
    tool: shell
    action: block
    when:
      conditions:
        - {field: tool.input.command, op: contains, pattern: rm -rf}
    text: Do not run rm -rf.
  - id: shell-failed
    target: tool
    tool: shell
    at: after
    when:
      conditions:
        - {field: tool.output, op: contains, pattern: command not found}
    text: Read the error before retrying.
```

准备隔离环境，并定义一个带上隔离参数的 `s` 函数：

```bash
T=$(mktemp -d)
mkdir -p "$T/home" "$T/proj" "$T/codex" "$T/claude"
s() { CODEX_HOME="$T/codex" CLAUDE_CONFIG_DIR="$T/claude" style --project "$T/proj" --style-home "$T/home" "$@"; }
```

校验、安装和审批（确认提示输入 `y` 回车）：

```bash
style validate ./au-demo
style plan ./au-demo --harness codex,claude-code
s link ./au-demo --harness codex,claude-code
s sync
```

### 重放 Codex 事件

`pre.json`：

```json
{"session_id":"s1","turn_id":"t1","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf build"}}
```

`post.json`，Codex 的 `tool_response` 是字符串：

```json
{"session_id":"s1","turn_id":"t1","cwd":"/tmp","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"foo"},"tool_response":"zsh: command not found: foo"}
```

```bash
s explain --harness codex --payload pre.json
s explain --harness codex --payload post.json
```

输出（节选）：

```text
entry "au-demo/guard-rm@tool.pre" ... selector=pass sources=pass when=pass render=pass block=blocked repeat=repeat-bypass output=blocked
wire stdout="{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Do not run rm -rf.\"}}"

entry "au-demo/shell-failed@tool.post" ... selector=pass sources=pass when=pass render=pass block=pass repeat=claimed output=output
wire stdout="{\"hookSpecificOutput\":{\"additionalContext\":\"Read the error before retrying.\",\"hookEventName\":\"PostToolUse\"}}"
```

### 重放 Claude Code 事件

Claude Code 的 `tool_response` 是对象：

```json
{"session_id":"s1","cwd":"/tmp","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"foo"},"tool_response":{"stdout":"","stderr":"zsh: command not found: foo"}}
```

```bash
s explain --harness claude-code --payload post.json
```

输出和 Codex 相同：`shell-failed` 命中并注入。

### 修改后同步

```bash
# 修改 au-demo/STYLE.yaml 里 guard-rm 的正文
s sync
s explain --harness codex --payload pre.json   # 拒绝理由变成新正文
```

确认无误后，去掉 `s` 的隔离参数，在真实环境中安装，再用 `style doctor` 和 `style stats` 观察实际运行。

## 相关

- [cli.md](cli.md)（`explain`、`link`、`sync` 的全部参数）
- [action.md](action.md)（去重与 block 优先）
- [budget.md](budget.md)（token 估算与输入上限）
- [when.md](when.md)（条件字段在哪些事件上可用）

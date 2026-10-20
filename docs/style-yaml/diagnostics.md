---
title: diagnostics：诊断码总表
scope: concept
keys: []
spec: style/v0.3
sources:
  - core/spec/validate.go
  - core/spec/validate_package.go
  - core/spec/validate_rules.go
  - core/spec/validate_template.go
  - core/spec/validate_conditions.go
  - core/spec/validate_lints.go
  - core/spec/validate_files.go
  - core/spec/native.go
  - core/spec/load.go
  - core/spec/package_files.go
  - core/tokens/analyze.go
  - core/tokens/installed.go
  - internal/app/entry.go
  - internal/app/harness_requirement.go
  - internal/app/json_envelope.go
  - internal/app/command.go
  - internal/app/explain.go
  - internal/app/registration.go
---

# diagnostics：诊断码总表

> 汇总 `style validate`、`style plan`、安装流程和其他命令报告的诊断码，并指向详细说明它们的页面。

## 概览

包的诊断码分为三个阶段；命令执行失败时另有一组[命令诊断码](diagnostics.md#命令)：

1. **加载**：读取文件、解析 YAML 和 front matter。遇到错误立即中止，一次只报告一个。
2. **校验**：检查字段结构、取值和跨字段约束，一次报告全部问题。
3. **计划与安装**：估算 token、检查 harness 版本和安装总量。

每条诊断都有级别：

- **error**：包不能安装。
- **warning**：包可以安装，但很可能不符合作者的本意。

## 行为

### 输出格式

文本模式下诊断写到 stderr，每行一条：

```text
style <命令>: [warning ]<诊断码>[ <位置>]: <说明>
```

warning 级诊断前加 `warning`，error 不加前缀；没有位置时省略位置。说明小写开头，不以句号结尾。完整的输出约定见 [cli.md](cli.md#输出位置)。

位置的常见写法：

| 写法 | 指向 |
|---|---|
| `STYLE.yaml` | 包级字段 |
| `STYLE.yaml#<id>` | STYLE.yaml 中的内联规则 |
| `STYLE.yaml#<id>:when.conditions[0]` | 规则的第一个条件 |
| `STYLE.yaml:settings[0]` | 第一个配置项 |
| `STYLE.yaml#native_hooks/<id>` | 原生 hook |
| `rules/<name>.md` | 规则文件 |
| `codex`、`claude-code` | 按 harness 计算的 token 诊断 |

`--json` 模式下诊断在 [JSON 报告](cli.md#json-报告) 的 `diagnostics` 数组里，每项包含 `code`、`severity`、`message`，可能有 `path`、`rule`、`provider`。

### 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功；只有 warning 时也是 0 |
| 1 | 加载失败、有 error 级诊断、请求被拒绝，或确认提示被取消 |
| 2 | 命令行写错了（用法错误），见 [cli.md](cli.md#退出码) |
| 3 | `style sync` 发现开发链接包需要审批（`style trust`） |
| 4 | 计划被拒绝：有规则为 `install-error`，或 `T002` / `T004` 为 error（`T001` 为 error 时校验就失败，退出码为 1） |

## 诊断码

### 加载

详见 [overview.md](overview.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `invalid-package` | error | 入口不是目录或 `.style.md` 文件；`rules` / `native_hooks` 不是列表或含非 mapping 项；`from` 为空 |
| `invalid-yaml` | error | YAML 无法解析、不是 mapping 或包含多个文档 |
| `invalid-frontmatter` | error | front matter 缺少开始或结束的 `---` |
| `bad-encoding` | error | 文件不是 UTF-8 文本或包含 NUL 字节 |
| `file-not-found` | error | 引用的文件不存在，或 `from` glob 没有匹配 |
| `file-read` | error | 文件无法读取，或不是普通文件 |
| `file-too-large` | error | 文件超过 256 KiB |
| `path-escape` | error | 路径不是包内相对路径 |
| `symlink` | error | 包入口或包内路径上有符号链接 |
| `bad-glob` | error | `from` glob 语法无效 |
| `file-into-rules` | error | `file` 指向 `rules/` 下的文件 |
| `body-has-frontmatter` | error | `file` 引用的正文文件带有 front matter |
| `native-format-removed` | error | 使用了已移除的 `target: native` |

### 包级字段

详见 [package.md](package.md)、[requires.md](requires.md)、[budget.md](budget.md)、[defaults.md](defaults.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `invalid-spec` | error | `spec` 不是 `style/v0.3` |
| `bad-name` | error | `name` 不符合命名规则 |
| `bad-version` | error | `version` 不是语义化版本 |
| `defaults-field` | error | `defaults` 中使用了不允许的键 |
| `sensitive-reserved` | error | 配置项使用了保留字段 `sensitive` |
| `undeclared-rule-file` | warning | `rules/` 下的 `.md` 文件没有被任何 `from` 引用 |

### 规则

详见 [rules.md](rules.md)、[target.md](target.md)、[action.md](action.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `invalid-schema` | error | 通用结构错误：未知字段、类型错误、取值不在枚举中、缺少必填字段等 |
| `bad-id` | error | `id` 格式无效 |
| `dup-id` | error | `id` 与其他规则或原生 hook 重复 |
| `inline-missing-id` | error | 内联规则缺少 `id` |
| `file-and-text` | error | 同时写了 `file` 和 `text` |
| `from-and-inline` | error | `from` 条目写了 `id`、`file` 或 `text` |
| `override-target` | error | `from` 条目覆盖 `target` 或 `id` |
| `rule-file-pkg-field` | error | 规则文件 front matter 写了除 `priority` 外的包级字段 |
| `empty-body` | error | 正文为空 |
| `marker-in-body` | error | 正文包含保留标记 `<!-- style:` |
| `action-target` | error | block 用在不支持的目标或事件上 |
| `block-after` | error | block 规则设为 `at: after` |
| `fail-closed-target` | error | `fail: closed` 用在不能直接拒绝的评估点 |
| `replace-non-system` | error | 非 system 规则使用 `mode: replace` |
| `refresh-invalid` | error | `refresh` 不是 0 到 1000000 的整数 |
| `refresh-incompatible` | error | 正数 `refresh` 与动作、`repeat`、`mode` 或事件不兼容 |
| `block-repeat` | warning | block 规则声明了 `repeat` |
| `reinject-unused` | warning | `reinject_on_compact: true` 但 `repeat` 不是 `session` |
| `sources-unused` | warning | `sources` 声明在不经过 `session.start` 的规则上 |
| `model-text-unused` | warning | 非 warn 规则写了 `model_text` |

### 模板

详见 [rules.md](rules.md#模板语法)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `invalid-template` | error | 模板语法错误，例如缺少 `}}`、默认值没有加引号 |
| `undeclared-var` | error | 未声明或不支持的变量 |
| `event-var-in-template` | error | 没有用 `event.` 前缀引用事件内容 |
| `event-var-unavailable` | error | 事件内容在该规则的事件上不可用 |
| `event-warn-model-text` | error | warn 规则引用事件内容但没有 `model_text` |
| `var-no-default` | warning | 运行时变量可能为空，且没有默认值 |

### when 条件

详见 [when.md](when.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `bad-model-glob` | error | `model` glob 语法无效 |
| `bad-provider-id` | error | `provider` 标识格式无效 |
| `bad-effort-expr` | error | `thinking_effort` 格式无效 |
| `bad-regex` | error | 正则表达式无效 |
| `empty-pattern` | error | 子串类运算符的 `pattern` 为空 |
| `condition-field-wrong-event` | error | 条件字段在规则的评估点上不可用 |
| `negated-optional-field` | warning | 对可能缺失的字段使用 `not_contains` |
| `whole-tool-input` | warning | 条件字段是整个 `tool.input` |
| `whole-tool-output` | warning | 条件字段是整个 `tool.output`，且规则不是只选中 `tool: shell` |

### 原生 hook

详见 [native-hooks.md](native-hooks.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `native-field` | error | 字段类型错误；使用了规则或包级字段；不支持的扩展字段；未注册的 harness |
| `native-mapping` | error | 没有任何 harness 映射，或映射不是 mapping |
| `native-event` | error | 缺少 `event`，或该 harness 不支持这个事件 |
| `native-matcher` | error | matcher 无效，或用在不接受 matcher 的事件上 |
| `native-command` | error | 命令为空或违反格式限制 |
| `native-timeout` | error | `timeout` 不是 1 到 600 的整数 |

### token 预算

详见 [budget.md](budget.md)。`T001`、`T002`、`T004` 的级别由 `budget.on` 决定，默认是 warning。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `T001` | 由 `budget.on` 决定 | 单条规则估算值超过 `max_tokens` |
| `T002` | 由 `budget.on` 决定 | 同一事件的合计超过 `per_event` |
| `T003` | error | 所有已安装包在某事件上的合计超过 adapter 输入上限的 80% |
| `T004` | 由 `budget.on` 决定 | 常驻内容合计超过 `always_on` |
| `T005` | warning | block 拒绝理由超过 40 tokens |
| `T006` | warning | 模板使用了 `harness.session_id` 或 `harness.turn_id` |
| `T007` | warning | inject 规则重复注入（`repeat: every` / `turn` 或正数 `refresh`）但缺少 `reason` |

### 计划与安装

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `harness-version` | warning | harness 版本不满足 `requires.harness`，该 harness 被跳过，见 [requires.md](requires.md) |

`style plan` 还会在规则状态下给出原因说明。以下两种原因会让规则变为 `install-error` 或 `skipped`，见 [action.md](action.md)：

- `fail-closed-unsupported`：`fail: closed` 规则的原评估点不支持 deny，或经过了降级。
- `refresh-unsupported-platform`：当前平台不支持 refresh 所需的会话锁。

计划状态（`native`、`degraded`、`partial`、`skipped`、`never-trigger`、`native-hook`、`install-error`）的含义见 [fallback.md](fallback.md#计划状态)。

### 命令

命令失败时报告的诊断码。脚本应当按这些码判断失败原因，不要解析说明文字。详见 [cli.md](cli.md)。

| 诊断码 | 级别 | 触发条件 |
|---|---|---|
| `source-invalid` | error | 来源地址或 `--ref` 格式错误（退出码 2）；拉取后包路径或 ref 不存在（退出码 1） |
| `request-rejected` | error | 请求无法满足：包未安装、`--all` 而没有安装任何包、对非 Git 包使用 `--ref` 等 |
| `confirmation-declined` | error | 确认提示没有回答 `y`，没有做任何修改 |
| `blocked` | error | 计划、安装、恢复或更新被阻止，退出码 4 |
| `conflict` | error | 与已有安装冲突 |
| `lock-invalid` | error | `style.lock.yaml` 无法读取或不是合法的 lock |
| `frozen-metadata-incomplete` | error | `restore` 读到的 lock 可以解析，但缺少格式或格式不受支持 |
| `registration-required` | error | 插件已写入，但需要在 harness 里手动注册才会加载 |
| `project-binding-invalid` | error | `--project` 指定的项目无法绑定，例如目录不存在 |
| `probe-not-installed` | error | `probe` 时没有可读的安装 |
| `probe-timeout` | error | `probe` 等待回调超时 |
| `event-mismatch` | error | `explain --event` 与 payload 的 `hook_event_name` 不一致 |
| `fail-closed-unsupported` | error | `explain --fail-closed` 用在 Claude Code 以外的 harness 上 |
| `payload-invalid` | error | `explain` 的 payload 无法读取或格式不对 |
| `facts-invalid` | error | `explain --facts` 文件不存在或格式不对 |
| `index-invalid` | error | `explain --index` 文件不存在或不是有效的索引 |
| `state-snapshot-invalid` | error | `explain --state-dir` 目录不存在或不可读 |
| `state-snapshot-changed` | error | `explain` 读取状态时状态被改动 |
| `provenance-unavailable` | warning | 编译来源不可用，`explain` 只按索引说明 |
| `command-failed` | error | 错误本身没有诊断码时的兜底 |

用法错误（退出码 2）不输出 JSON 报告，只在 stderr 写原因和 usage。

## 示例

```yaml
spec: style/v0.3
name: diag-demo
version: 0.1.0
description: diagnostics example
defaults:
  repeat: turn
rules:
  - id: shell-guidance
    target: tool
    tool: shell
    text: Prefer rg over grep.
```

`style validate diag-demo` 的 stderr：

```text
style validate: warning T007 STYLE.yaml#shell-guidance: inject with repeat every or turn should include reason
```

`style validate diag-demo --json`：

```json
{
  "format": 2,
  "command": "validate",
  "status": "ok",
  "scope": {"kind": "user", "home": "/Users/me/.style"},
  "diagnostics": [
    {
      "code": "T007",
      "path": "STYLE.yaml#shell-guidance",
      "severity": "warning",
      "message": "inject with repeat every or turn should include reason"
    }
  ],
  "result": null
}
```

只有 warning，退出码为 0。给规则加上 `reason` 后警告消失。

## 相关

- [概览：包的形态与加载流程](overview.md)
- [fallback：落点不可用时的处理](fallback.md)
- [budget：token 预算](budget.md)

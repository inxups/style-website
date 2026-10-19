---
title: 命令行：style 使用指南
scope: concept
keys: []
spec: style/v0.3
sources:
  - internal/app/cliflags.go
  - internal/app/entry.go
  - internal/app/confirm.go
  - internal/app/lifecycle_command.go
  - internal/app/frozen_command.go
  - internal/app/update_command.go
  - internal/app/sync_command.go
  - internal/app/project_command.go
  - internal/app/lifecycle_store.go
  - internal/source/source.go
---

# 命令行：style 使用指南

> `style` 命令行的全部命令、参数、确认提示和退出码。编写、安装、排查一个 STYLE 包时查这一页。

## 概览

`style` 把 STYLE 包编译后安装到 Codex、Claude Code 等 harness，并负责之后的更新、同步、审批和卸载。命令分三组：

| 分组 | 命令 | 作用 |
|---|---|---|
| 编写 | `init` `validate` `count` `plan` | 生成骨架、校验、计 token、预览安装计划；不写入安装目录 |
| 安装 | `install` `restore` `update` `uninstall` `sync` `trust` | 修改安装状态和 harness 配置 |
| 诊断 | `list` `doctor` `probe` `stats` `explain` | 查看安装状态、健康检查、模拟运行时 |

安装状态保存在 STYLE 主目录，依次取 `--style-home`、环境变量 `STYLE_HOME`、`~/.style`（`internal/app/lifecycle_store.go`）。目录里的 `style.lock.yaml` 记录已安装的包、来源、设置和每个 harness 的 route，`build/` 下是编译后的运行时索引。

### 通用约定

- `style --help` 列出所有命令；`style help <command>` 或 `<command> --help` 还会列出该命令的 advanced 和 project 参数。`--help` / `-h` 放在命令行任何位置都有效。
- 取值参数写成 `--ref v` 或 `--ref=v` 都可以。布尔参数不带值：写 `--json`，不写 `--json=true`。
- 标 `...` 的参数可以重复，例如 `--set a=1 --set b=2`。未知参数和多余的位置参数都是用法错误。
- `--json` 让 stdout 只输出一份 JSON 报告，便于脚本解析。

### 确认提示

`install`、`restore`、`update`、`uninstall`、`trust` 会先打印预览（计划、token、路由、要写入的原生命令），再在 stderr 提示 `[y/N]`，从 stdin 读一行回答（`internal/app/confirm.go`）：

- 只有 `y` 或 `yes`（不区分大小写）会执行。
- 回车、其他内容、没有输入（EOF）都算取消：stderr 输出 `<command> canceled; nothing was changed`（`trust` 为 `trust canceled; nothing was approved`），不写任何文件，退出码 1。
- 不是终端时同样从 stdin 读。脚本和 CI 需要显式回答，例如 `echo y | style install ./pkg`。
- 带 `--json` 时预览和提示都写到 stderr，stdout 只有最终的 JSON 报告。取消时 JSON 报告的 `awaiting_confirmation` 为 `true`。

没有 `--yes` 之类跳过确认的参数。

### 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功；只有 warning 时也是 0 |
| 1 | 用法错误、加载或校验失败、冲突、确认被取消 |
| 3 | `style sync` 发现开发链接包需要重新审批，见 [`trust`](cli.md#trust) |
| 4 | 被阻止：计划中有 `install-error` 或 token 超限，或安装、恢复、更新被阻止 |

## 包来源

`validate`、`plan`、`install` 接受同一种来源写法：

| 来源 | 写法 | 说明 |
|---|---|---|
| 目录包 | `./my-pkg` | 目录下的 `STYLE.yaml` |
| 单文件包 | `./note.style.md` | 一个 `*.style.md` 文件 |
| Git 仓库 | `git+https://host/org/repo` | 只支持 HTTPS，URL 不能带凭据、query 或 fragment |

Git 来源可以加两个参数（`internal/source/source.go`）：

- `--ref`：完整的 `refs/heads/<branch>`、`refs/tags/<tag>`，或完整的小写 commit OID。不给时用远端默认分支。
- `--path`：仓库内的包路径，必须是规范的相对路径，默认是仓库根目录。

本地来源不能用 `--ref` 和 `--path`（报 `source-invalid`）。Git 来源不能用 `--link`。

## 命令

### `init`

```text
style init [name] [--single]
```

在当前目录生成包骨架。默认生成目录包 `<name>/`，包含 `STYLE.yaml`、`prompts/default.md` 和 `rules/review.md`；`--single` 生成单文件包 `<name>.style.md`。

### `validate`

```text
style validate [source] [--ref ref] [--path repo-path] [--json]
```

校验一个包，不给来源时校验当前目录的 `STYLE.yaml`。通过时输出 `valid`；有 error 级诊断时退出码为 1。`--json` 输出诊断数组，每项包含 `code`、`path`、`severity`、`message`，诊断码见 [diagnostics.md](diagnostics.md)。

### `count`

```text
style count <UTF-8-file> [--exact openai:<encoding>|anthropic:<model>] [--json]
```

计算一个 UTF-8 文本文件的 token 数。

- 不给 `--exact`：本地估算（`mode=estimate`），不联网。
- `--exact openai:<encoding>`：用本地 tiktoken 编码精确计数，例如 `openai:o200k_base`。
- `--exact anthropic:<model>`：调用 Anthropic 的计数接口，需要环境变量 `ANTHROPIC_API_KEY`，文件内容会发送给 Anthropic。

### `plan`

```text
style plan <source> [--ref ref] [--path repo-path] [--harness auto|codex,claude-code]... [--exact ...] [--json]
  advanced: [--assume-requests N] [--assume-triggers N]
```

预览包在各 harness 上的安装计划，不写入任何文件：每条规则的落点和降级（见 [fallback.md](fallback.md)）、首选 route、token 估算和预算（见 [budget.md](budget.md)）。

- `--harness`：默认 `auto`，即本机检测到的全部 harness；可以写 `codex`、`claude-code`，或用逗号、重复参数选多个。
- `--exact`：token 计数方式，含义同 [`count`](cli.md#count)。
- `--assume-requests`、`--assume-triggers`：会话成本场景里的请求数和触发次数，默认 60 和 3。这只是场景估算，不是账单。

有规则为 `install-error`，或 token 诊断为 error 时，退出码为 4。

### `install`

```text
style install <source> [--ref ref] [--path repo-path] [--harness h]... [--set k=v]... [--json]
  advanced: [--route h=r]... [--link] [--allow-replace] [--fail-closed]
  project:  [--project dir] [--style-home dir] [--project-source source]... [--project-set package.key=value]...
```

先输出与 `plan` 相同的预览，再按 [确认提示](cli.md#确认提示) 询问，确认后写入 STYLE 主目录和 harness 配置。

- `--harness`：默认安装到本机检测到的全部 harness。已经安装过的 harness 会保留，并随这次安装一起重新编译。
- `--set k=v`：为包的 `settings` 赋值。没有默认值的设置必须提供，否则报 `setting "k" requires --set k=value`，见 [requires.md](requires.md)。
- `--route h=r`：指定 harness 的安装 route，例如 `--route codex=codex-user`。可选 route 有 `codex-plugin`、`codex-user`、`claude-user`、`claude-plugin`；项目范围内分别为 `codex-project`、`claude-project`。不指定时用 `plan` 显示的首选 route。
- `--link`：开发链接。不复制包文件，之后由 [`sync`](cli.md#sync) 读取源目录的修改。只适用于本地来源。
- `--allow-replace`：包里有 `mode: replace` 的 system 规则时必须加上，表示确认替换 harness 的系统指令。
- `--fail-closed`：只支持 Claude Code。STYLE 的 hook 处理失败或索引不可用时拒绝工具调用，而不是放行，见 [action.md](action.md)。设置保存在 lock 中，之后的安装和同步沿用。
- `--project-source`、`--project-set`：在项目范围内一次安装多个包，见 [项目范围](cli.md#项目范围)。

同一个包重复安装且内容没有变化时，结果为 unchanged，不改写任何文件。

### `restore`

```text
style restore [--allow-replace] [--json]
```

按 `style.lock.yaml` 和 STYLE 主目录里保存的包快照，离线重建安装：重新生成 `build/` 下的运行时索引，修复 harness 配置。不读取原始来源，不访问网络，lock 文件本身保持不变。适合 `build/` 被删除或损坏、harness 配置被改乱之后恢复。

lock 中的 STYLE 可执行文件路径或配置目录与当前不一致时拒绝执行，需要先用 `install` 重新绑定。

### `update`

```text
style update <name|--all> [--ref ref] [--allow-replace] [--json]
```

从 lock 记录的来源重新读取包并升级，预览中会对比更新前后的版本和原生命令。

- 指定包名只更新这个包；`--all` 更新所有包。两者必须二选一。
- `--ref`：Git 来源改用另一个 ref。
- 没有变化时结果为 unchanged。

### `uninstall`

```text
style uninstall <name|--all> [--json]
```

卸载指定的包，或用 `--all` 卸载全部包，并重新编译其余的包。确认提示为 `Uninstall <name>?` 或 `Uninstall all packages?`。卸载全部包后，STYLE 写入的 harness 配置会被移除。

### `sync`

```text
style sync [--json]
```

重新读取开发链接（`--link`）包的源目录，并清理过期的会话状态。复制安装的包不受源目录修改影响，要用 [`update`](cli.md#update) 升级。

- 链接包安装后还没有用 [`trust`](cli.md#trust) 审批过：不写入，输出 `approval required: style trust <name>`，退出码为 3。
- 审批之后只改了普通规则：直接重新编译并写入，不需要确认。
- 原生 hook 的声明、顺序或配置变了：同样不写入，退出码为 3，需要重新审批。

### `trust`

```text
style trust <name> [--allow-replace] [--json]
```

审批一个开发链接包的当前快照。预览会列出源文件差异、编译结果差异和将要写入的原生命令，确认后按这个快照安装。`install --link` 之后要先审批一次；之后对普通规则的修改由 `sync` 直接接受，原生 hook 再次变化时需要重新审批。包新增了 `mode: replace` 时要加 `--allow-replace`。

### `list`

```text
style list [--json]
```

列出已安装的包：版本、安装顺序（`seq`）、来源、是否开发链接（`link=dev`）、文件是否与 lock 一致（`hash_matches`）、原生 hook 数量。

### `doctor`

```text
style doctor [--reset-state] [--json]
```

健康检查。输出 `healthy=true|false`、已安装的包、每个 harness 的版本和配置目录、各 route 的可用和安装状态，以及每个事件的输出能力和可用字段，最后是诊断（例如 route 未被外部信任、effort 不可用）。发现错误时退出码非 0。

`--reset-state` 删除运行时状态目录（会话状态等），不加时只清理过期的会话。

### `probe`

```text
style probe [--harness h] [--timeout 60s] [--json]
```

验证已安装的 hook 能否被真实的 harness 调用到。`probe` 不启动 harness，也不改写安装：它在 stderr 输出 `probe ready: run_id=...` 后开始等待，你需要在超时前到对应的 harness 会话里触发一个订阅的事件（例如运行一条 shell 命令）。

- `--harness`：只能选一个；不给时检查所有已安装的 harness。
- `--timeout`：等待时间，范围 1s 到 10m，默认 60s。

结果中 `callback_observed=true` 表示收到了回调。规则执行和模型实际收到的内容不在 `probe` 的检查范围内。

### `stats`

```text
style stats [--by rule|session] [--since <duration|RFC3339>] [--json]
```

汇总运行时记录：输出次数、拦截、去重、预算截断和估算 token。默认统计最近 7 天、按规则分组。

- `--by session`：按会话分组。
- `--since`：时间窗口的起点，可以是时长（`24h`）或 RFC3339 时间。

### `explain`

```text
style explain --harness h --payload f.json [--event NativeEvent] [--fail-closed] [--exact ...] [--json]
  advanced: [--index f] [--state-dir d] [--facts f] [--provenance f]
```

用一份 harness 事件 payload 模拟运行时，说明哪些规则匹配、`when` 条件的结果、渲染内容，以及最终写回 harness 的 stdout、stderr 和退出码。只读：不写状态，不执行原生命令。

- `--harness`：只能选一个 harness。
- `--payload`：harness 的原生事件 JSON，必须包含 `hook_event_name` 和 `session_id`。
- `--event`：可省略，默认取 payload 的 `hook_event_name`；显式给出时必须与它一致，否则报 `event-mismatch`。
- `--fail-closed`：按 `install --fail-closed` 的处理方式模拟，只支持 `claude-code`。
- `--index`、`--provenance`：运行时索引和编译来源，默认取 STYLE 主目录的 `build/index.json` 和 `build/explain.json`。
- `--state-dir`：读取这个目录里的真实会话状态再模拟，例如 refresh 计数。不给时从空状态开始。
- `--facts`：补充 payload 中没有的运行时事实（模型、effort 等），用于检查 `when` 条件。

## 项目范围

`--project <dir>` 把 `plan`、安装类和诊断类命令限定到一个项目。`--style-home` 可以和它一起使用。

- 项目的安装状态保存在 STYLE 主目录的 `projects/<hash>/` 下，与用户级安装分开，预算和会话状态也各自独立。
- 项目目录中会写入 `.style/project.json` 和项目级 harness 配置（`.codex/`、`.claude/settings.json`），route 为 `codex-project` / `claude-project`。
- 输出开头会列出前提条件：harness 能在 `PATH` 中找到 `style`、使用同一个 `STYLE_HOME`、项目已被 harness 信任，以及当前已有的用户级包。
- 其他人克隆项目后，hook 不会自动生效，需要在自己的机器上再运行一次 `style install ... --project <dir>`。
- `install --project-source <source>` 可以在全新的项目安装中再附加最多 63 个包，与主包作为一次安装确认。附加包的设置用 `--project-set <package>.<key>=<value>`。这两个参数不能和 `--link` 一起用。

## 示例

### 从零编写并安装

```bash
style init demo
style validate demo
style plan demo --harness claude-code
style install demo --harness claude-code     # 查看预览，输入 y 回车
style list
```

### 开发链接

```bash
style install ./demo --link                  # 确认安装
style trust demo                             # 首次审批，输入 y 回车
# 修改 demo/rules/review.md
style sync                                   # 普通规则修改直接生效
# 修改 STYLE.yaml 里的 native_hooks
style sync                                   # 退出码 3：approval required: style trust demo
style trust demo                             # 查看差异，输入 y 回车
```

### 脚本与 CI

```bash
echo y | style install ./demo --json > report.json
style install ./demo --json < /dev/null      # 只预览：退出码 1，awaiting_confirmation=true
echo y | style uninstall --all
```

### 排查一条规则为什么没有输出

```bash
style doctor
style explain --harness claude-code --payload event.json
```

`event.json` 是 harness 发给 hook 的事件，例如：

```json
{"session_id":"s1","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"cwd":"/tmp"}
```

## 已移除的写法

以下写法已删除，没有兼容入口，使用时报用法错误：

| 已移除 | 改用 |
|---|---|
| `style install --frozen` | `style restore` |
| `style adapters` | `style doctor` |
| `--count=exact --count-provider=P --encoding=E` / `--count-model=M` | `--exact openai:E` / `--exact anthropic:M` |
| `install --fail-closed claude-code` | `install --fail-closed` |
| `install` 等命令的 `--yes` | 在确认提示中输入 `y` |

## 相关

- [overview.md](overview.md)
- [fallback.md](fallback.md)
- [budget.md](budget.md)
- [requires.md](requires.md)
- [action.md](action.md)
- [diagnostics.md](diagnostics.md)

---
title: 命令行：style 使用指南
scope: concept
keys: []
spec: style/v0.3
sources:
  - internal/app/cliflags.go
  - internal/app/entry.go
  - internal/app/command.go
  - internal/app/confirm.go
  - internal/app/json_envelope.go
  - internal/app/lifecycle_command.go
  - internal/app/frozen_command.go
  - internal/app/update_command.go
  - internal/app/sync_command.go
  - internal/app/inspect_command.go
  - internal/app/probe_command.go
  - internal/app/doctor.go
  - internal/app/count_command.go
  - internal/app/init_command.go
  - internal/app/explain.go
  - internal/app/project_command.go
  - internal/app/project_packages.go
  - internal/app/registration.go
  - internal/app/lifecycle_store.go
  - internal/source/source.go
---

# 命令行：style 使用指南

> `style` 命令行的全部命令、参数、确认提示、输出格式和退出码。编写、安装、排查一个 STYLE 包时查这一页。

## 概览

`style` 把 STYLE 包编译后安装到 Codex、Claude Code 等 harness，并负责之后的更新、同步、审批和卸载。命令分三组：

| 分组 | 命令 | 作用 |
|---|---|---|
| 编写 | `init` `validate` `count` `plan` | 生成骨架、校验、计 token、预览安装计划；不写入安装目录 |
| 安装 | `install` `link` `restore` `update` `uninstall` `sync` | 修改安装状态和 harness 配置 |
| 诊断 | `list` `doctor` `stats` `explain` | 查看安装状态、健康检查（含实时回调检查）、模拟运行时 |

安装状态保存在 STYLE 主目录，依次取全局参数 `--style-home`、环境变量 `STYLE_HOME`、`~/.style`（`internal/app/lifecycle_store.go`）。目录里的 `style.lock.yaml` 记录已安装的包、来源、设置和每个 harness 的 route，`build/` 下是编译后的运行时索引。

### 通用约定

- `style --help` 列出所有命令；`style help <command>` 或 `<command> --help` 还会列出该命令的 advanced 参数和可用的全局参数。`--help` / `-h` 放在命令行任何位置都有效。
- `style --version` 输出 `style 0.3.0` 这样的一行，退出码 0，后面不能再带其他参数。
- 取值参数写成 `--ref v` 或 `--ref=v` 都可以。值可以是负数（例如 `--since -1h`），这时由参数自己的范围检查报错，不会被当成缺少值。
- 布尔参数不带值：写 `--json`，不写 `--json=true`。
- 标 `...` 的参数可以重复，例如 `--set a=1 --set b=2`。未知参数和多余的位置参数都是用法错误。
- `--json` 让 stdout 只输出一份 JSON 报告，格式见 [JSON 报告](cli.md#json-报告)。

### 全局参数

`--project` 和 `--style-home` 是全局参数，写在命令名之前：

```text
style [--project dir] [--style-home dir] <command> ...
```

- `--project <dir>`：把命令限定到一个项目，见 [项目范围](cli.md#项目范围)。
- `--style-home <dir>`：代替环境变量 `STYLE_HOME`。用户范围内就是安装所在的主目录；和 `--project` 一起用时，是项目绑定在哪个主目录下。
- 相对路径按当前目录解析。
- 写在命令名之后是用法错误，报错会写出正确位置，例如 `--project is a global option; write it before the command: style --project dir list`。
- `init`、`validate`、`count` 不接受全局参数，使用时报 `--project is not supported by this command`（或 `--style-home`）。
- 缺少值、值为空、重复，或只有全局参数没有命令，都是用法错误。这类错误发生在识别命令之前，所以写成 `style: <原因>`，下一行是全局用法 `style [--project dir] [--style-home dir] <command> ...`。

### `--harness`

`plan`、`install`、`link`、`doctor --live`、`explain` 用同一套 `--harness` 写法：

- 可以重复，也可以用逗号分隔：`--harness codex --harness claude-code` 等于 `--harness codex,claude-code`。
- 不区分大小写；`claude` 是 `claude-code` 的别名。
- `auto` 是默认值：`plan`、`install`、`link` 选本机检测到的 harness，`doctor --live` 选所有已安装的 harness。
- `explain` 只读一份 payload，必须正好指定一个具体的 harness，否则报用法错误 `select exactly one harness`。
- 未知或空的名字都是用法错误（退出码 2），例如 `unknown harness "bogus"`。

### 确认提示

`install`、`link`、`restore`、`update`、`uninstall`、需要审批的 `sync`，以及 `doctor --reset-state`，会先打印预览（计划、token、路由、要写入的原生命令，或要删除的目录），再在 stderr 提示 `[y/N]`，从 stdin 读一行回答（`internal/app/confirm.go`）：

- 只有 `y` 或 `yes`（不区分大小写）会执行。
- 回车、其他内容、没有输入（EOF）都算取消：不写任何文件，退出码 1，stderr 输出一行 `style <command>: confirmation-declined: <command> canceled; nothing was changed`。
- 不是终端时同样从 stdin 读。脚本和 CI 需要显式回答，例如 `echo y | style install ./pkg`。
- 每个提示只读一行。一次命令里有多个提示时（`sync` 逐个审批多个包），管道里的每一行依次回答一个提示，例如 `printf 'y\ny\n' | style sync`。
- 带 `--json` 时预览和提示都写到 stderr，stdout 只有最终的 JSON 报告。取消时报告的 `diagnostics` 里有一条 `confirmation-declined`，`result` 仍是预览，其中 `awaiting_confirmation` 为 `true`。

没有变化时不会提示：`update`、`restore` 结果为 unchanged，`sync <name>` 在已审批的快照没有变化时直接输出 `sync complete (changed=false, ...)`，三者都退出 0。`uninstall` 会先检查目标包是否已安装，不存在时直接报错，不会提示。

没有 `--yes` 之类跳过确认的参数。

### 输出位置

| 内容 | 文本模式 | `--json` 模式 |
|---|---|---|
| 命令的报告 | stdout | stdout，一份 [JSON 报告](cli.md#json-报告) |
| 诊断、警告、失败原因 | stderr，每条一行 | 报告的 `diagnostics`；失败时 stderr 另写一行原因 |
| 预览和确认提示 | 预览在 stdout，提示在 stderr | 都在 stderr |
| 用法错误 | stderr：原因加 usage，stdout 为空 | 同文本模式，stdout 为空 |

`doctor`、`explain` 的报告本身就包含诊断，所以文本模式下报告留在 stdout；命令失败时 stderr 再加一行，说明退出码为什么不是 0。

stderr 的每一行都是同一种格式：

```text
style <command>: [warning ]<code>[ <where>]: <message>
```

- `warning` 只出现在 warning 级诊断前；error 不加前缀。
- `<code>` 是诊断码，错误本身没有诊断码时省略。
- `<where>` 是位置，例如 `STYLE.yaml#rule-id`，没有位置时省略。
- `<message>` 小写开头，不以句号结尾。

例如：

```text
style validate: warning T007 STYLE.yaml#g: inject with repeat every or turn should include reason
style update: request-rejected: package "foo" is not installed
style count: notes.txt: file does not exist
```

用法错误先写一行原因，再写该命令的 usage：

```text
style plan: unknown harness "bogus"
style plan [source] [--harness auto|h[,h]]... [--exact openai:<encoding>|anthropic:<model>] [--json]
  advanced: [--assume-requests N] [--assume-triggers N]
  global, before the command: [--project dir] [--style-home dir]
```

文本报告只列出有值的字段，不会出现 `key=` 或 `key=""` 这样的空字段。唯一的例外是 `explain` 的 `wire` 行，它原样引用 hook 的输出，`stderr=""` 表示 hook 确实没有写 stderr。

### JSON 报告

每个命令的 `--json` 输出都是同一个外层结构（`internal/app/json_envelope.go`）：

```json
{
  "format": 2,
  "command": "list",
  "status": "ok",
  "scope": {"kind": "user", "home": "/Users/me/.style"},
  "diagnostics": [],
  "result": {"packages": []}
}
```

| 字段 | 含义 |
|---|---|
| `format` | 外层结构的版本，目前是 `2` |
| `command` | 命令名 |
| `status` | 与退出码对应：`ok`（0）、`error`（1）、`blocked`（4）；退出码 2 不输出 JSON |
| `scope` | `{"kind": "user", "home": ...}`，或项目范围的 `{"kind": "project", "root", "base_home", "home", "external_prerequisites", "coexisting_user_packages"}`。键的顺序固定。项目无法绑定时只有 `kind` 和请求的 `root` |
| `diagnostics` | 报告的顶层诊断，每项包含 `code`、`severity`、`message`，可能有 `path`、`rule`、`provider` |
| `result` | 命令自己的报告；报告里除了诊断没有别的内容时为 `null`，例如 `validate`，或者命令在生成报告前就失败了 |

命令失败时，`diagnostics` 至少有一条带诊断码的记录：错误自带的码（例如 `source-invalid`、`invalid-package`、`request-rejected`、`lock-invalid`、`conflict`、`blocked`），没有时为 `command-failed`。命令级诊断码见 [diagnostics.md](diagnostics.md#命令)。

用法错误（退出码 2）不输出 JSON，stdout 为空。

### 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功；只有 warning 时也是 0 |
| 1 | 请求被拒绝或执行失败：加载或校验失败、包未安装、harness 未检测到、缺少必需的 `--set`、冲突、确认或审批被取消、插件等待原生注册、`doctor` 发现错误 |
| 2 | 命令行写错了：未知命令或参数；未知的 harness 或 route；缺少、格式错误或互相冲突的参数，包括格式错误的 Git 来源地址和 `--ref` |
| 4 | 被阻止：计划中有 `install-error` 或 token 超限，或安装、恢复、更新被阻止 |

判断 1 和 2 的界线：只看命令行本身就能发现的问题是 2；命令行写对了，但包、安装状态或本机 harness 满足不了的请求是 1。例如 Git 地址格式错误是 2，地址正确但仓库里没有这个包路径是 1。

harness 调用 hook 时从不返回 2，因为 Claude Code 会把 hook 的退出码 2 当作拦截。

## 包来源

`validate`、`plan`、`install` 接受同一种来源写法；`link` 只接受本地目录或单文件：

| 来源 | 写法 | 说明 |
|---|---|---|
| 目录包 | `./my-pkg` | 目录下的 `STYLE.yaml` |
| 单文件包 | `./note.style.md` | 一个 `*.style.md` 文件 |
| Git 仓库 | `git+https://host/org/repo.git//pkg/path?ref=refs/tags/v1` | 只支持 HTTPS，URL 不能带凭据或 fragment |

Git 来源的两个选择器都写在地址里，都可以省略（`internal/source/source.go`）：

- `//path`：仓库内的包路径，必须是规范的相对路径，默认是仓库根目录。
- `?ref=`：完整的 `refs/heads/<branch>`、`refs/tags/<tag>`，或完整的小写 commit OID，默认用远端 HEAD。`+` 按字面处理，`refs/tags/v1.0.0+build` 不需要写成 `%2B`。

`install` 给出多个来源时，每个来源都带自己的选择器，可以分别固定版本。

规则：

- 地址格式错误（例如 `?ref=main` 不是完整 ref）是用法错误，退出码 2，诊断码仍为 `source-invalid`。
- 拉取之后才发现的问题，例如包路径不存在、ref 在远端不存在，退出码 1，诊断码 `source-invalid`。
- 本地来源不存在时报 `<source>: package source does not exist`，诊断码 `invalid-package`。
- Git 来源不能 `link`，报 `source-invalid: link needs a local directory; Git sources cannot be linked`，退出码 2。

## 命令

### `init`

```text
style init [name] [--single]
```

在当前目录生成包骨架。默认生成目录包 `<name>/`，包含 `STYLE.yaml`、`prompts/default.md` 和 `rules/review.md`；`--single` 生成单文件包 `<name>.style.md`。

- 不给 `name` 时用当前目录名作为包名，在当前目录里生成。当前目录不为空时报 `init directory is not empty: <path>`，退出码 1。
- 显式给出的 `name` 为空或不符合命名规则（小写字母、数字和连字符）时是用法错误，退出码 2。由目录名推出的包名不合规则时退出码 1。
- 目标已存在时报 `init destination already exists: <path>`，退出码 1。

### `validate`

```text
style validate [source] [--json]
```

校验一个包，不给来源时校验当前目录的 `STYLE.yaml`。通过时 stdout 输出 `valid`，诊断（包括 warning）写到 stderr；有 error 级诊断时退出码为 1。`--json` 的诊断在报告的 `diagnostics` 里，`result` 为 `null`。诊断码见 [diagnostics.md](diagnostics.md)。

### `count`

```text
style count <UTF-8-file> [--exact openai:<encoding>|anthropic:<model>] [--json]
```

计算一个 UTF-8 文本文件的 token 数。

- 不给 `--exact`：本地估算（`mode=estimate`），不联网。
- `--exact openai:<encoding>`：用本地 tiktoken 编码精确计数，只支持 `o200k_base` 和 `cl100k_base`。
- `--exact anthropic:<model>`：调用 Anthropic 的计数接口，需要环境变量 `ANTHROPIC_API_KEY`，文件内容会发送给 Anthropic。

`--exact` 的值不合法时，在 `count`、`plan`、`explain` 里都是用法错误（退出码 2）。

文件读不了时，报错写出路径和原因，退出码 1：`file does not exist`、`not a regular file`、`file exceeds N bytes`、`file is not valid UTF-8`。

### `plan`

```text
style plan [source] [--harness auto|h[,h]]... [--exact ...] [--json]
  advanced: [--assume-requests N] [--assume-triggers N]
  global, before the command: [--project dir] [--style-home dir]
```

预览包在各 harness 上的安装计划，不写入任何文件：每条规则的落点和降级（见 [fallback.md](fallback.md)）、首选 route、token 估算和预算（见 [budget.md](budget.md)）。

- `source`：不给时用当前目录，和 `validate` 一样。
- `--harness`：见 [`--harness`](cli.md#--harness)。
- `--exact`：token 计数方式，含义同 [`count`](cli.md#count)。
- `--assume-requests`、`--assume-triggers`：会话成本场景里的请求数和触发次数，默认 60 和 3，必须是正整数。这只是场景估算，不是账单。

有规则为 `install-error`，或 token 诊断为 error 时，退出码为 4。这时报告的 `diagnostics` 里有一条 `blocked`，写明哪个 harness 上哪条诊断阻止了安装，文本模式下同一句话也写到 stderr。

### `install`

```text
style install <source>... [--harness auto|h[,h]]... [--set [package.]k=v]... [--json]
  advanced: [--route h=r]... [--allow-replace] [--fail-closed]
  global, before the command: [--project dir] [--style-home dir]
```

先输出与 `plan` 相同的预览，再按 [确认提示](cli.md#确认提示) 询问，确认后写入 STYLE 主目录和 harness 配置。

- `--harness`：默认安装到本机检测到的全部 harness。已经安装过的 harness 会保留，并随这次安装一起重新编译。
- `<source>...`：通常是一个来源。多个来源只用于全新的项目安装，见 [项目范围](cli.md#项目范围)。
- `--set k=v`：为包的 `settings` 赋值。没有默认值的设置必须提供，否则报 `setting "k" requires --set k=value`（退出码 1），见 [requires.md](requires.md)。有多个来源时每个设置都要写包名：`--set <package>.<key>=<value>`，主包也一样。
- `--route h=r`：指定 harness 的安装 route，例如 `--route codex=codex-user`。可选 route 有 `codex-plugin`、`codex-user`、`claude-user`、`claude-plugin`；项目范围内分别为 `codex-project`、`claude-project`。不指定时用 `plan` 显示的首选 route。未知的 harness 或 route 是用法错误。
- `--allow-replace`：包里有 `mode: replace` 的 system 规则时必须加上，表示确认替换 harness 的系统指令。
- `--fail-closed`：Claude Code 专用。STYLE 的 hook 处理失败或索引不可用时拒绝工具调用，而不是放行，见 [action.md](action.md)。它会选中 claude-code；如果显式的 `--harness` 没有包含 claude-code，是用法错误。设置保存在 lock 中，之后的安装和同步沿用。

同一个包重复安装且内容没有变化时，结果为 unchanged，不改写任何文件，退出码 0。

选择 `claude-plugin` 这类需要在 harness 里手动注册的 route 时，文件会写好，但 harness 要等注册之后才会加载。这时退出码为 1，诊断码 `registration-required`，报告里列出需要运行的注册命令。

### `link`

```text
style link <dir> [--harness auto|h[,h]]... [--set k=v]... [--json]
  advanced: [--route h=r]... [--allow-replace] [--fail-closed]
  global, before the command: [--project dir] [--style-home dir]
```

把本地包目录（或单文件包）安装为开发链接：不复制包文件，之后由 [`sync`](cli.md#sync) 读取源目录的修改。参数和预览与 `install` 相同，确认提示为 `Link with these capabilities?`，完成时输出 `linked <name> <version>`。

- 只接受本地来源，一次一个。Git 来源报 `source-invalid`（退出码 2）。
- 链接后的第一次 `sync` 需要审批一次，见 [`sync`](cli.md#sync)。
- 用 [`uninstall <name>`](cli.md#uninstall) 移除链接，与普通安装相同。

### `restore`

```text
style restore [--allow-replace] [--json]
  global, before the command: [--project dir] [--style-home dir]
```

按 `style.lock.yaml` 和 STYLE 主目录里保存的包快照，离线重建安装：重新生成 `build/` 下的运行时索引，修复 harness 配置。不读取原始来源，不访问网络，lock 文件本身保持不变。适合 `build/` 被删除或损坏、harness 配置被改乱之后恢复。

- lock 中的 STYLE 可执行文件路径或配置目录与当前不一致时拒绝执行，需要先用 `install` 重新绑定。
- lock 不是合法的 YAML 时报 `lock-invalid`，和其他命令一致。lock 可以解析，但缺少格式或格式不受支持时报 `frozen-metadata-incomplete`。

### `update`

```text
style update <name|--all> [--ref ref] [--allow-replace] [--json]
  global, before the command: [--project dir] [--style-home dir]
```

从 lock 记录的来源重新读取包并升级，预览中会对比更新前后的版本和原生命令。

- 指定包名只更新这个包；`--all` 更新所有包。两者必须二选一。
- `--ref`：Git 来源改用另一个 ref。格式错误是用法错误（退出码 2）；对非 Git 包使用时报 `request-rejected`（退出码 1）。
- 包未安装时报 `package "<name>" is not installed`；`--all` 而没有安装任何包时报 `no packages are installed`。两者都是 `request-rejected`，退出码 1。
- 没有变化时结果为 unchanged，不提示，退出码 0。

### `uninstall`

```text
style uninstall <name|--all> [--json]
  global, before the command: [--project dir] [--style-home dir]
```

卸载指定的包，或用 `--all` 卸载全部包，并重新编译其余的包。

先检查目标：包未安装，或 `--all` 而没有安装任何包时，直接报 `request-rejected`（退出码 1），不提示。目标存在时先打印删除预览（要移除的包和 route），再提示 `Uninstall <name>?` 或 `Uninstall all packages?`。卸载全部包后，STYLE 写入的 harness 配置会被移除。

### `sync`

```text
style sync [name] [--allow-replace] [--json]
  global, before the command: [--project dir] [--style-home dir]
```

重新读取开发链接包的源目录和已安装包的快照，重新编译并写入，同时清理过期的会话状态。复制安装的包要用 [`update`](cli.md#update) 从来源升级。

不需要审批的修改直接写入，不提示：已审批的链接包只改了普通规则时就是这样。以下修改需要审批：

- 链接包第一次 `sync`（即使源目录没有修改）。
- 复制安装的包在 STYLE 主目录里的快照被改动。
- 原生 hook 的声明、顺序或配置变了。

需要审批时，`sync` 一次处理一个包：打印该包的源文件差异、编译结果差异和原生 hook 差异，提示 `Approve <name>?`。确认后这个包作为一次独立的事务写入，然后再处理下一个包。写入的内容就是预览里看到的快照；预览之后源目录又被改动时拒绝写入。

- 回答 `y`：该包写入，继续下一个。全部完成后输出 `approved: <name>, ...` 和 `sync complete (changed=..., expired sessions=N)`，退出码 0。
- 其他回答或没有输入：停止，退出码 1，诊断码 `confirmation-declined`。之前已确认的包已经写入，这时消息为 `sync canceled; already approved and applied: <name>, ...`；一个都没有确认时为 `sync canceled; nothing was changed`。
- `sync <name>`：只审批这个包。其他需要审批的包保留原来已审批的快照，输出里会写 `approval required: style sync <other>`。已审批的快照没有变化时不提示，退出码 0。
- 包未安装时报 `request-rejected`（退出码 1）。
- 包新增了 `mode: replace` 时要加 `--allow-replace`。
- `--json` 的 `result` 中，`approved` 列出这次确认的包，`changes` 里包括它们的差异。

### `list`

```text
style list [--json]
  global, before the command: [--project dir] [--style-home dir]
```

列出已安装的包：版本、安装顺序（`seq`）、来源、是否开发链接（`link=dev`）、文件是否与 lock 一致（`hash_matches`）、原生 hook 数量。没有包时输出 `No packages installed.`。

### `doctor`

```text
style doctor [--reset-state] [--live] [--json]
  advanced: [--harness auto|h[,h]]... [--timeout 60s]
  global, before the command: [--project dir] [--style-home dir]
```

健康检查。文本输出的顺序：

1. `healthy=true|false`。
2. 诊断，每行一条，warning 带 `warning` 前缀，例如 `warning effort-unknown: codex: effort is unavailable; ...`。
3. 已安装的包，格式同 `list`。
4. 每个 harness：版本、配置目录、各 route 的可用和安装状态、输入上限，以及每个事件的输出能力和可用字段。本机没检测到的 harness 只输出一行摘要，完整矩阵仍在 `--json` 里。
5. 原生 hook、effort 来源、最近 7 天 token 最多的规则（没有时写 `none`）和状态目录统计。
6. 加了 `--live` 时，最后是实时检查的结果。

发现错误时退出码 1，stderr 写一行第一个 error 级诊断。

不加参数时，`doctor` 会清理过期的会话状态。`--reset-state` 删除整个运行时状态目录（会话状态和规则统计），删除前提示 `Remove all runtime state in <dir>, including sessions and rule statistics?`。取消时什么都不改，过期会话也不清理，退出码 1，诊断码 `confirmation-declined`。

#### `--live`

先做上面的检查，再验证已安装的 hook 能否被真实的 harness 调用到。`doctor` 不启动 harness，也不改写安装：它在 stderr 输出 `probe ready: run_id=...` 后开始等待，你需要在超时前到对应的 harness 会话里触发一个订阅的事件（例如运行一条 shell 命令）。

- `--harness`：见 [`--harness`](cli.md#--harness)，默认 `auto`，即所有已安装的 harness。
- `--timeout`：等待时间，范围 1s 到 10m，默认 60s。
- `--harness` 和 `--timeout` 只能和 `--live` 一起用，否则报 `--timeout requires --live` 这样的用法错误。

文本输出最后是 `live "<run_id>": <status> (timeout=...)` 和每个 harness 一行，`callback_observed=true` 表示收到了回调。`--json` 的结果在 `live` 字段，它的诊断并入报告的 `diagnostics`。没有安装时报 `probe-not-installed`；lock 已存在但无法读取时报 `lock-invalid`；超时报 `probe-timeout`。规则执行和模型实际收到的内容不在检查范围内。

### `stats`

```text
style stats [--by rule|session] [--since <duration|RFC3339>] [--json]
  global, before the command: [--project dir] [--style-home dir]
```

汇总运行时记录：输出次数、拦截、去重、预算截断和估算 token。默认统计最近 7 天、按规则分组。

- `--by session`：按会话分组。
- `--since`：时间窗口的起点，可以是正的时长（`24h`）或不晚于当前时间的 RFC3339 时间。负数时长是用法错误。

### `explain`

```text
style explain --harness h --payload f.json [--event NativeEvent] [--fail-closed] [--exact ...] [--json]
  advanced: [--index f] [--state-dir d] [--facts f] [--provenance f]
  global, before the command: [--project dir] [--style-home dir]
```

用一份 harness 事件 payload 模拟运行时，说明哪些规则匹配、`when` 条件的结果、渲染内容，以及最终写回 harness 的 stdout、stderr 和退出码。只读：不写状态，不执行原生命令。

- `--harness`：必须正好一个具体的 harness。
- `--payload`：harness 的原生事件 JSON，必须包含 `hook_event_name` 和 `session_id`。
- `--event`：可省略，默认取 payload 的 `hook_event_name`；显式给出时必须与它一致，否则报 `event-mismatch`。
- `--fail-closed`：按 `install --fail-closed` 的处理方式模拟，只支持 `claude-code`，其他 harness 报 `fail-closed-unsupported`。
- `--index`、`--provenance`：运行时索引和编译来源，默认取 STYLE 主目录的 `build/index.json` 和 `build/explain.json`。
- `--state-dir`：读取这个目录里的真实会话状态再模拟，例如 refresh 计数。不给时从空状态开始。
- `--facts`：补充 payload 中没有的运行时事实（模型、effort 等），用于检查 `when` 条件。

输入文件有问题时，报错会写明是哪一个：

| 情况 | 诊断码 | 说明 |
|---|---|---|
| `--facts` 文件不存在 | `facts-invalid` | `facts file does not exist` |
| `--index` 文件不存在 | `index-invalid` | `index file does not exist` |
| `--state-dir` 目录不存在 | `state-snapshot-invalid` | `state directory does not exist` |
| 读取状态时状态被改动 | `state-snapshot-changed` | `selected state changed during capture` |
| 显式的 `--provenance` 文件不存在 | `provenance-unavailable`（warning） | `provenance file does not exist; index-only coverage`；仍会模拟，退出码 0 |

## 项目范围

全局参数 `--project <dir>` 把 `plan`、安装类和诊断类命令限定到一个项目，写在命令名之前：`style --project . install ./pkg`。`init`、`validate`、`count` 不支持 `--project`，使用时是用法错误。

- `--style-home <dir>` 指定项目绑定在哪个 STYLE 主目录下，代替 `STYLE_HOME`。
- 项目的安装状态保存在 STYLE 主目录的 `projects/<hash>/` 下，与用户级安装分开，预算和会话状态也各自独立。
- 项目目录中会写入 `.style/project.json` 和项目级 harness 配置（`.codex/`、`.claude/settings.json`），route 为 `codex-project` / `claude-project`。
- 输出开头会列出前提条件：harness 能在 `PATH` 中找到 `style`、使用同一个 `STYLE_HOME`、项目已被 harness 信任，以及当前已有的用户级包。
- 项目无法绑定（例如目录不存在）时报 `project-binding-invalid`，`--json` 的 `scope` 只有 `kind` 和请求的 `root`。
- 其他人克隆项目后，hook 不会自动生效，需要在自己的机器上再运行一次 `style --project <dir> install ...`。

全新的项目安装可以一次给 `install` 多个来源，最多 64 个，作为一次预览、一次确认、一次事务安装：

```bash
style --project . install ./rules ./review --set rules.tone=calm --set review.voice=short
```

有多个来源时，每个 `--set` 都要写成 `<package>.<key>=<value>`，主包也一样；缺少设置时的提示也带包名，例如 `setting "tone" requires --set rules.tone=value`。不满足条件时，报错会写明是哪一条：

| 报错 | 退出码 |
|---|---|
| `installing several sources requires --project` | 2 |
| `with several sources, --set needs package.key=value` | 2 |
| `install accepts at most 64 sources` | 2 |
| `installing several sources requires a fresh project installation` | 1 |

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
style link ./demo                            # 确认安装
style sync                                   # 首次审批：Approve demo? 输入 y 回车
# 修改 demo/rules/review.md
style sync                                   # 普通规则修改直接生效，不提示
# 修改 STYLE.yaml 里的 native_hooks
style sync                                   # 显示原生 hook 差异，Approve demo? 输入 y 回车
```

### 脚本与 CI

```bash
echo y | style install ./demo --json > report.json
style install ./demo --json < /dev/null      # 只预览：退出码 1，confirmation-declined
echo y | style uninstall --all
```

脚本判断结果时，先看退出码：2 说明命令行写错了，1 说明请求被拒绝或失败。再看 `diagnostics[].code`，不要解析 `message` 的文字。

### 排查一条规则为什么没有输出

```bash
style doctor
style explain --harness claude-code --payload event.json
```

`event.json` 是 harness 发给 hook 的事件，例如：

```json
{"session_id":"s1","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"cwd":"/tmp"}
```

## 已知局限

- **`--help` 不受 `--json` 影响。** `style install --help --json` 仍输出文本帮助；`style help --json` 把 `--json` 当成命令名，报 `unknown command`。
- **`doctor --live` 的进度写在 stderr。** `probe ready: run_id=...` 等提示即使在 `--json` 模式下也写到 stderr，stdout 只有最终报告。
- **`doctor --live` 先做完整的健康检查。** 实时检查之前会先检测 harness、检查安装，耗时比单独的回调检查长。
- **`sync` 中途取消时，已确认的包不会回滚。** 每个包的审批是一次独立的事务；取消之后，之前确认的包保持已写入。
- **脚本里的 `sync` 需要为每个待审批的包各写一行回答。** 没有回答时取消，退出码 1，不再有单独的“需要审批”退出码。
- **`registration-required` 时文件已经写入。** 安装退出 1，但生成的插件文件和 lock 已经更新；按报告运行注册命令后，harness 才会加载插件。
- **`explain` 一次只能模拟一个 harness。** 要比较两个 harness，需要分别运行。
- **拉取后才发现的 Git 问题不是用法错误。** 包路径或 ref 在远端不存在时退出码是 1，不是 2，因为要看远端仓库的状态才知道。
- **`doctor` 的文本输出不含未检测到的 harness 的能力矩阵。** 需要时用 `--json`。
- **多个来源只能用于全新的项目安装。** 已有安装的项目要逐个 `install`；用户范围不支持一次安装多个来源。
- **旧写法 `install <src> --fail-closed claude-code` 会被当作两个来源。** 用户范围报 `installing several sources requires --project`；项目范围里会把 `claude-code` 当作本地路径，报 `package source does not exist`。

## 已移除的写法

以下写法已删除，没有兼容入口，使用时报用法错误：

| 已移除 | 改用 |
|---|---|
| `style install --frozen` | `style restore` |
| `style adapters` | `style doctor` |
| `--count=exact --count-provider=P --encoding=E` / `--count-model=M` | `--exact openai:E` / `--exact anthropic:M` |
| `install --fail-closed claude-code` | `install --fail-closed` |
| `install` 等命令的 `--yes` | 在确认提示中输入 `y` |
| `validate`、`plan`、`install` 的 `--ref R --path P` | `git+https://…/repo.git//P?ref=R` |
| `--json` 报告的旧格式（`validate` 输出数组、项目范围外包一层 `scope`） | 统一的 [JSON 报告](cli.md#json-报告)，读 `result` 字段 |
| `style <command> --project dir` | `style --project dir <command>` |
| `--style-home` 只能和 `--project` 一起用 | `style --style-home dir <command>` 在用户范围内也可用 |
| `style probe` | `style doctor --live` |
| `style install <dir> --link` | `style link <dir>` |
| `style trust <name>` | `style sync <name>` |
| `sync` 的退出码 3 和 `status: needs-trust` | `sync` 直接提示审批；取消为退出码 1、`confirmation-declined` |
| `install --project-source S --project-set P.K=V` | `install S1 S2 --set P.K=V` |

## 相关

- [overview.md](overview.md)
- [fallback.md](fallback.md)
- [budget.md](budget.md)
- [requires.md](requires.md)
- [action.md](action.md)
- [diagnostics.md](diagnostics.md)

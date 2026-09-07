# 独立命令行使用说明

`cph-ng-judge` 同时提供前台 CLI 和 `serve` RPC 服务。CLI 直接调用同一套 application commands、任务调度器、编译器和评测执行器，无需先启动服务，也不需要 VS Code。

## 安装与快速开始

在 `packages/judge-kernel` 中构建或安装：

```sh
cargo build --release -p cph-ng-judge
cargo install --path . --locked
cph-ng-judge --help
```

构建产物在 Cargo workspace 的 `target/release/cph-ng-judge`（Windows 为 `.exe`）。也可使用 `cargo run -p cph-ng-judge -- <命令和参数>`。需要在 PATH 中安装所用语言的编译器/解释器，或通过 `config set --input FILE` 写入工具链配置。独立下载包和跨平台发布步骤见 [发布说明](releasing.md)。

直接评测一个源文件：

```sh
cph-ng-judge run main.cpp --input-file sample.in --answer-file sample.out
cph-ng-judge run main.py --input-text '1 2' --answer-text '3'
printf '1 2\n' | cph-ng-judge run main.py --input-file - --answer-text '3'
cph-ng-judge run main.cpp --input-file sample.in --answer-file sample.out --output json
```

`run` 是 `judge run` 的快捷入口；`r` 是 `run` 的可见别名，`tc` 是 `testcase` 的可见别名（也支持 `judge r`、`tc r`）。别名和完整命令使用同一实现、参数校验与补全。提供输入或答案时执行一个临时测试点：未登记的源文件会自动创建题目，临时输入和答案不加入已保存的测试点。未提供的一侧按空字符串处理，因此仅运行程序而没有答案时，程序输出仍会与空答案比较。

没有临时输入时运行题目中保存的测试点。未登记的题目需要先创建/导入；没有测试点会明确报错。

```sh
cph-ng-judge problem create main.cpp --name 'A + B'
cph-ng-judge testcase add main.cpp --input-file sample.in --answer-file sample.out
cph-ng-judge judge run main.cpp
```

## 输入与答案命名

| 数据 | 直接传文本 | 从文件读取 |
| --- | --- | --- |
| Input | `--input-text TEXT` | `--input-file FILE` / `-i FILE` |
| Answer | `--answer-text TEXT` | `--answer-file FILE` |

两侧都支持空文本和以负号开头的内容，例如 `--input-text '-1 2'`；文件值 `-` 表示 stdin，但一次命令只能有一侧读取 stdin。文本和对应文件参数互斥。旧 `--stdin` → `--input-text`、`--answer` → `--answer-text`、`--input` / `--stdin-file` → `--input-file` 继续兼容，旧 `--input FILE` 不会突然被解释成文本。`import --input`、`config set --input` 仍表示导入文件/TOML 文件，语义不变。

人类输出统一使用 **Input / Answer / Output**：Answer 是标准答案，Output 是程序实际输出；旧 Expected output 标签已改为 Answer。JSON/RPC 的 `stdin`、`answer`、`stdout` 字段保持协议兼容，外部 Companion 格式仍遵守其 `input`/`output` 字段约定。

## 通用参数与存储

| 参数 | 含义 |
| --- | --- |
| `--store-root DIR` | 共享 SQLite、题目、编译产物和历史目录；默认 `$HOME/.cph-ng`，Windows 也读取 USERPROFILE；可用 `CPH_STORE_ROOT` 设置 |
| `--output human\|json\|jsonl` | 默认 human；`--format` 是别名，`--json` 等价于 `--output json` |
| `--quiet` / `-q` | 关闭 human 模式的 stderr 进度，保留最终结果 |
| `--workspace-root DIR` | 可重复；显式限制文件访问范围为这些目录与 store |
| `--task-timeout-ms N` | 本次创建的任务总时限，包含排队、编译和运行，默认 300000 ms |
| `--wait-timeout-ms N` | 等待其他进程任务的最长时间，默认 300000 ms；超时不会取消该任务 |

通用参数可以放在子命令前后。命令接受的相对路径以当前工作目录为基准。独立 CLI 默认可读取用户有权限访问的文件；RPC `serve` 仍要求显式的 workspace roots。输入、答案和源码必须为 UTF-8，单份读取最多 16 MiB；同一测试点两侧合计以及每题保存的测试数据合计最多 16 MiB。

所有模式都不询问确认、不打开编辑器，不因 stdin 是否为终端而改变行为。无效导入和越界数值直接返回退出码 2，保留原数据，不自动截断数值。`--ci`、`--yes` 和 `config edit` 已移除。源码创建仍拒绝覆盖已有文件；stdin 仅用于明确指定 `-` 的数据来源（如 `--input-file -`、`--answer-file -`、`import -`）或 RPC 数据流。

题目引用可以是源文件位置参数、`--problem-id UUID` 或 `--code-id UUID`，三者互斥。每份源码有独立 code_id，多份源码可共享同一 problem_id；移动保留源码 ID。仅使用 problem_id 运行时选择题目的主源码，运行指定关联源码应使用路径或 code_id。源文件丢失后仍可按 ID 查询；历史按 code_id 分离，按 problem_id 则汇总整题。

## 题目与测试点

| 命令 | 用途 |
| --- | --- |
| `problem list` | 题目摘要列表 |
| `problem load SOURCE` | 读取题目及测试点；别名 `show` |
| `problem create SOURCE --name NAME` | 登记已有源码；可用 `--source-code TEXT` 创建新源码 |
| `problem update SOURCE [配置参数]` | 持久化名称、URL、时限、内存和辅助程序设置 |
| `problem delete SOURCE` | 删除题目、测试点和索引；保留源码及独立历史 |
| `problem move SOURCE --destination PATH` | 移动源码并更新同一题目身份，目标已存在时拒绝覆盖 |
| `problem move --code-id UUID --destination PATH --rebind-only` | 源码已被外部移动时，仅重新绑定所选源码的位置 |
| `problem link SOURCE --destination OTHER_SOURCE` | 让另一份已有源码共享样例和标准，运行历史独立 |
| `problem sources SOURCE` | 列出题目的全部源码 ID 和路径 |
| `problem export SOURCE --destination FILE` | 导出原生包；兼容格式需显式接受数据损失 |
| `testcase list SOURCE` | 读取 `{id, stdin, answer}` 数组 |
| `testcase add SOURCE [数据参数]` | 新增测试点，可指定 `--testcase-id UUID` |
| `testcase update SOURCE --testcase-id UUID [数据参数]` | 修改指定测试点；未指定的一侧保持原值 |
| `testcase delete SOURCE --testcase-id UUID` | 删除测试点 |
| `testcase reorder SOURCE --testcase-id UUID1,UUID2` | 按给定顺序排列，必须恰好包含全部测试点 |
| `testcase run SOURCE --testcase-id UUID` | 运行一个保存的测试点 |
| `testcase run-all SOURCE` | 运行全部测试点；也可通过 `--testcase-id` 选择子集 |

数据参数为 `--input-text TEXT` / `--input-file FILE` 和 `--answer-text TEXT` / `--answer-file FILE`。同一侧不能同时指定文本和文件。文件名 `-` 表示读取 stdin，两个文件参数中最多一个使用 `-`。这些参数也用于 `judge run` 的临时测试点；临时测试点不能与 `--testcase-id` 混用。

题目配置示例：

```sh
cph-ng-judge problem update main.cpp --name 'A + B' --url https://example.com/problem
cph-ng-judge problem update main.cpp --time-limit-ms 2000 --memory-limit-mb 512
cph-ng-judge problem update main.cpp --checker checker.cpp
cph-ng-judge problem update main.cpp --interactor interactor.cpp
cph-ng-judge problem update main.cpp --generator gen.cpp --brute-force brute.cpp
cph-ng-judge problem update main.cpp --clear-url --clear-checker --clear-interactor --clear-stress
```

时限范围为 1–300000 ms，内存范围为 1–65535 MiB。`--time-limit` / `--memory-limit` 是对应参数的别名。清除压力测试配置会同时清除生成器和暴力解。

`problem move` 复制源码内容与文件权限，在绑定成功后移除原路径；普通错误会尝试回滚。它不会替换已存在的目标，也不是跨文件系统的原子 rename。对指向其他文件的符号链接，请移动实际源码或在外部移动后使用 `--rebind-only`。

## 评测、SPJ、交互与对拍

以下操作会等待任务完成、写入结果和历史后退出。每次运行记录源码快照和 SHA-256，编译失败也能读取历史。

```sh
cph-ng-judge judge run main.cpp
cph-ng-judge run main.cpp --skip-compile
cph-ng-judge run main.cpp --force-compile
cph-ng-judge judge run main.cpp --testcase-id UUID1 --testcase-id UUID2
cph-ng-judge judge run main.cpp --time-limit-ms 2000 --memory-limit-mb 512
cph-ng-judge judge run main.cpp --checker-mode exact --output-limit-bytes 1048576
cph-ng-judge judge run main.cpp --checker-mode float --tolerance 0.000001
cph-ng-judge judge run main.cpp --checker checker.cpp
cph-ng-judge judge run main.cpp --interactor interactor.cpp
cph-ng-judge judge run main.cpp --interactor interactor.cpp --checker checker.cpp
cph-ng-judge stress start main.cpp --generator gen.cpp --brute-force brute.cpp --iterations 1000 --seed 42
```

`judge run`、`testcase run[-all]`、`stress start` 上的资源和辅助程序参数仅用于当前运行，不改写题目配置；持久化请使用 `problem update`。支持 C、C++、Rust、Python、JavaScript、Java，与 RPC 使用同一套工具链配置。Python/JavaScript 也执行语法检查。

默认自动复用 `STORE/cache/compilation` 下的编译缓存，命中后将产物复制到本次运行目录；终端结果标注 `Build: cached`。缓存覆盖解答、checker、交互器、生成器和暴力解，以及 Python/JavaScript 的语法检查。缓存键包含源码内容和路径、语言配置、编译参数、编译器路径/版本及相关环境变量；C/C++ 头文件和 Rust 编译器报告的文件依赖还会校验内容。产物缺失或损坏、依赖变化都会重新编译。修改运行时限或测试数据不会单独触发编译。

- `--skip-compile`：仅使用校验通过的缓存；没有有效缓存时以编译失败退出（3），不会悄悄运行旧二进制。
- `--force-compile`（别名 `--recompile`）：忽略缓存并重新编译，成功后更新缓存。

两个选项互斥，也适用于测试点运行和对拍中的所有辅助程序。缓存检查仍需可用的工具链以核对版本。自定义链接库、Java 外部 classpath 等编译器依赖文件未覆盖的外部输入发生变化时，请使用 `--force-compile`。删除 `STORE/cache/compilation` 可清空缓存，历史保留。

内置比较器为 tokens（默认，按空白分词）、exact（逐字节）、float（绝对/相对容差）和 legacy（兼容旧扩展）。legacy 另有 `--strict-stderr`、`--regard-pe-as-ac`、`--output-ratio-limit N`；这些选项必须与 `--checker-mode legacy` 一起使用。`--output-limit-bytes` 范围为 1–16777216，限制 stdout/stderr 总量。

SPJ 接收输入、实际输出、标准答案三个文件路径；交互器接收输入、交互记录、标准答案三个文件路径。协议和退出码见 [RPC 评测说明](rpc-protocol.md#编译器spj-与交互评测)。同时配置交互器和 checker 时，checker 检查交互器写出的交互记录。

对拍的生成器第一个参数为 seed，每轮加一；`--iterations` 范围为 1–1000000。发现差异后自动保存反例，并返回 seed、输入、答案、测试点 ID 和运行结果。终端 human 模式直接显示反例、期望/实际输出及失败原因；`--json` 保留完整数据。临时限时或辅助程序覆盖不会随反例写入题目配置。对拍不接受固定输入或保存的测试点选择。

`--client-request-id KEY` 支持幂等重试：相同 key 与相同参数返回原任务及其结果；修改参数需要换一个 key。

## 任务、取消与历史

```sh
cph-ng-judge task list
cph-ng-judge task get TASK_UUID
cph-ng-judge task wait TASK_UUID
cph-ng-judge task cancel TASK_UUID --wait
cph-ng-judge judge cancel TASK_UUID --wait
cph-ng-judge stress stop TASK_UUID --wait
cph-ng-judge task events --task-id TASK_UUID --since 0 --limit 100
cph-ng-judge task events --task-id TASK_UUID --since 0 --follow --output jsonl
cph-ng-judge history list main.cpp --limit 20 --offset 0
cph-ng-judge history list --problem-id PROBLEM_UUID
cph-ng-judge history load TASK_UUID
```

`task list` 返回 queued/running 任务；已完成任务通过 `history list` 查询。`task create` 可提交并等待一个空任务，用于检查存储和任务调度。`history load` / `show` 返回完整快照和结果，任务 ID 同时是运行 ID。`history list` 每页最多 100 条；`task events` / `events-since` 按全局 sequence 补读事件，每页最多 1000 条。

执行/写入命令与 `serve` 共用 store 所有权锁。同一 store 已有执行进程时，新的评测和修改命令返回 busy（退出码 2）；可在其他终端使用同一 store 查询题目、测试点、历史、活动任务，补读事件或请求取消。取消请求通过 SQLite 交给实际拥有任务的进程，CLI 不会把仍在运行的 RPC/CLI 任务误标记为异常恢复。

取消命令默认提交请求并返回当前状态，`--wait` 等待进程终止和最终状态落盘。取消命令成功退出 0，被取消的评测命令退出 130。前台评测收到 Ctrl-C/SIGTERM 时也会取消自身任务并保存最终状态；中断 `task wait` 或 `task events --follow` 只停止观察，不取消远端任务。查询/取消不要求编译配置有效。

Ctrl-Z 会暂停进程，暂停的进程仍持有 store 锁，也无法处理取消请求。此时 `task cancel` 会提示请求已提交；请在原终端用 `fg` 恢复该评测，让它处理取消并释放锁。`task wait` 被 Ctrl-C 中断时显示取消的是本次等待，不能据此判断原任务已经结束；以 `task get` 的最终状态为准。

查询命令不会接管崩溃进程的任务。进程意外退出后，下次取得 store 所有权的 CLI 写入/评测命令或 `serve` 会将遗留任务恢复为 canceled。等待超时返回 4，任务状态保持不变。需要多个相互独立的前台评测进程时，可使用不同的 `--store-root`。

## 导出与 fish 补全

```sh
cph-ng-judge export main.cpp --destination problem.cph
cph-ng-judge import problem.cph --destination ./received
cph-ng-judge export main.cpp --destination problem.json --export-format companion --dry-run
cph-ng-judge export main.cpp --destination problem.json --export-format companion --force
```

默认原生包包含所有关联源码、辅助程序、样例、配置和已完成历史；兼容格式在不指定 `--force` 时拒绝任何有损导出，并列出 `losses`。`--force` 不覆盖已存在的文件。原生包最多 128 MiB，旧格式 JSON/解压后最多 16 MiB。

```fish
mkdir -p ~/.config/fish/completions
cph-ng-judge completions fish > ~/.config/fish/completions/cph-ng-judge.fish
source ~/.config/fish/completions/cph-ng-judge.fish
```

补全到多级子命令、选项、枚举值和文件路径。也支持 bash、zsh、elvish 和 powershell；升级程序后重新生成脚本。UUID 暂不动态查询。

## 导入、索引和配置

```sh
cph-ng-judge import old.prob
cph-ng-judge import --input old.bin
cph-ng-judge problem import companion.json --source main.cpp
cat companion.json | cph-ng-judge import - --source main.cpp
cph-ng-judge index resolve main.cpp
cph-ng-judge index reindex main.cpp --problem-id PROBLEM_UUID
cph-ng-judge index rebuild main.cpp --problem-id PROBLEM_UUID
cph-ng-judge index rebuild
cph-ng-judge config path
cph-ng-judge config show
cph-ng-judge config init
cph-ng-judge config set --input compiler.toml
cph-ng-judge config main.cpp path
cph-ng-judge config --source main.cpp show
cph-ng-judge config main.cpp init
cph-ng-judge config main.cpp set --input problem-compiler.toml
cph-ng-judge capabilities --json
```

导入导出同时支持原生 `.cph`、Companion JSON、旧 `.prob` 和 gzip `.bin`，可用 `--import-format native|companion|prob|bin|auto` 指定。原生导入使用 `--destination NEW_DIR`，Companion 使用 `--source EXISTING_SOURCE`，旧格式可用 `--source` 覆盖包内源码路径。`--import-format legacy`、`import --input FILE` 和 `index rebuild SOURCE --problem-id UUID` 兼容语法保留。

详见 [题目共享与导入导出](exchange.md)，包括原生包结构、格式损失报告、复制索引和多源码历史模型。

全量 `index rebuild` 为前台等待的任务，返回成功数量、冲突和失败列表，部分失败退出 1。源文件移动后也可用 `index reindex` / `reindex-file` 重新绑定。

`config show` 输出合并的 TOML 配置；JSON 模式返回 `path`、`sources`、`config`、`toml`，不输出颜色转义。`config path` 不要求配置能成功解析。指定的源码必须已登记，不会在查找失败时悄悄退回全局配置。

`config init` 仅在配置文件不存在时写入默认内容，返回 `created: true/false`，不会覆盖已有文件。`config set --input FILE` 读取最多 1 MiB 的 UTF-8 TOML，校验类型及资源限值后原子替换整个配置文件；无效输入保留原文件。使用 `--input -` 可明确从 stdin 接收 TOML。指定源码时操作对应题目配置，否则操作全局配置；也可显式使用 `--scope global|problem`，problem 必须提供源码，global/router 不接受源码。`--scope` 可放在 config 子命令前后。

命令不会读取 VISUAL/EDITOR 或启动任何编辑器。可以用脚本生成 TOML 后调用 `config set`。全局配置设置工具链、编译时限和新题目的默认资源限制；题目配置用于编译器/解释器覆盖，已保存题目的评测资源限制用 `problem update` 修改。

## 设置页、工具链与浏览器网关

编译与评测设置已离开 VS Code 内置设置；样例扫描、旧导入路径和模板仍留有插件设置，详见 [迁移审计](migration-audit.md)。`CPH-NG: Open Kernel Settings` 打开完整设置页，内核负责保存、校验和继承；旧配置可预览后显式导入。设置页显示实际 store 路径，CLI 通过相同 `--store-root` 使用同一数据。

```sh
cph-ng-judge toolchain detect --language cpp --json
cph-ng-judge toolchain check --language cpp --kind compiler /usr/bin/clang++ --json
cph-ng-judge config --scope router show --json
cph-ng-judge config --scope router set --port 27122
cph-ng-judge router serve
```

`config show` 的有效值与实际编译一致；[judge] 可设置比较策略、输出限制、容差和对拍轮数。新任务录入时保存配置快照，之后的修改只影响新任务。检测不会自动保存工具链；CLI 通过 config set 写入选定值。

`config --scope router show --json` 返回 `{port,token}`，包含浏览器配对令牌。`config --scope router path/init/set` 管理同一份 `store/router/config.toml`；`set --port` 仅修改端口，保留令牌，要求网关已停止。`set --input FILE` 可替换完整路由 TOML。路由凭据与题目的可导出配置分开存储。旧 `router set` 隐藏保留为兼容入口；旧 `router info` 保留默认 JSON，新的 VS Code 客户端已使用 `config`。VS Code 命令 `CPH-NG: Copy Browser Pairing Token` 可复制它，在浏览器插件弹窗保存即可连接。网关替代旧 Node router，协议、端口、远程转发与职责边界见 [architecture.md](architecture.md)。

## 并发与差异查看

```sh
cph-ng-judge run main.cpp --jobs 2
cph-ng-judge run main.cpp --jobs 1
cph-ng-judge diff RUN_UUID
cph-ng-judge diff RUN_UUID --case 3 --context 5
```

`--jobs` / `-j` 为单次评测选择并发测试点数量，默认 **1**。请求范围 1–256；实际数量不超过测试点数、可用 CPU 数的一半（向下取整，至少 1）和 4。运行时保留最终结果的原测试点顺序，进度可按实际完成顺序更新。各测试点有独立的工作目录、SPJ 文件和交互记录。

同一内核进程内所有评测共享执行名额；默认串行任务独占名额，避免与该进程的其他评测/编译重叠。等待名额和准备文件不计入测试点耗时，但计入任务总超时。对拍保留串行和 seed 顺序，拒绝 `--jobs` 大于 1。

这里的耗时仍为实际经过时间。并发上限预留 CPU 余量，但无法隔离其他应用、其他 CLI 进程或测试程序自己创建的线程；并发模式适合快速检查正确性，接近时限的结果请用 `--jobs 1` 在系统空闲时复测，不把并发耗时视为隔离环境中的精确性能测量。

`diff` 默认选择第一个非 AC 测试点（全 AC 时选择第一个）；`--case` 对应本次评测表格中从 1 开始的编号。输出采用 Answer (`-`) / Output (`+`) 的上下文差异，并显示完整检查器说明和 stderr；`--context` / `-C` 控制上下文行数，默认 3，范围 0–100。它比较原始文本，因此 float、tokens、SPJ 等检查策略允许的文本差异不代表判定错误。`--json` 返回完整答案、实际输出、诊断和差异文本；此查看命令成功返回 0。

答案快照位于本地评测目录，修改、删除测试点或题目不影响原运行对比，临时测试点也支持。旧运行和导入历史可能没有快照，命令会明确提示重新评测，不会偷偷使用当前答案。快照目前不随原生历史导出包迁移。

## 输出契约与退出码

- human：最终结果写 stdout，命令错误写 stderr。终端评测从排队、编译、运行到完成均用表格显示；进度表在 stderr 原地刷新，结束或报错前清除，最终结果只保留一份。大批测试点优先显示正在运行的行，剩余结果在完成时列出；窄终端的进度表只保留编号和状态。`--quiet`、重定向和 `TERM=dumb` 关闭动态进度。`NO_COLOR` 关闭颜色，仍可使用光标控制刷新表格。
- 评测结论和通过数量放在首行，表格列出编号、判定、耗时、内存和 Details。每种判定颜色不同：AC 绿、WA 红、TLE 黄、RE 紫、PE 青、MLE 蓝、OLE 亮黄、CE 亮红、PC 亮蓝；取消和等待使用黄色或淡色。每段样式结束立即重置，外部控制字符转义；重定向始终无 ANSI 控制序列。
- Details 就地显示首个差异、检查器说明或诊断。tokens/float 比较按实际检查策略定位首个不同 token；exact/PE 显示从 1 开始的行、列，空白转义，文件结束显示 `<EOF>`。Details 按终端显示宽度截断，最多 72 列；较长内容以 `…` 结束，窄终端将说明移到表格后。单测试点的简短成功输出也显示在同一行。失败或较长输出在表格后给出可复制的 `diff` 命令；自定义 `--store-root` 会包含在提示中。
- 题目、测试点、任务、历史、事件、源码绑定和工具链列表使用对齐表格。测试点输入/答案以单行预览显示，换行和制表符显示为 `\n` / `\t`，超过 48 个显示列用 `…` 截断；完整数据可用 `testcase list SOURCE --json` 读取。配置路径和 TOML 保留适合管道的输出。
- json：stdout 只输出一个业务结果 JSON；长任务为完整 TaskInfo（含 `state`、`result`、`error`）。操作错误为 `{"error":{"code":...,"message":...}}`，不含 RPC envelope。
- jsonl：逐行输出 `{"type":"event","event":...}`，末尾为 `{"type":"result","result":...}`；操作错误为 `{"type":"error","error":...}`。事件先提交 SQLite，再输出；完成事件只出现一次。`task events --follow` 的末尾结果包含 `task` 与最后读取的 `sequence`。
- CLI 语法错误（例如无效 UUID、未知参数）也遵循所选 human/JSON/JSONL 错误格式，退出 2；`--help` / `--version` 使用普通文本。`serve` 开始运行后 stdout 专用于 JSON-RPC，启动/运行失败的诊断写 stderr；其错误码和退出码仍与 CLI 一致。

例如 `run main.py --input-text '1 2' --answer-text '3' --quiet` 的 human 输出：

```text
Accepted  1/1 testcases passed
Testcase  Verdict  Time   Memory  Details
Case 1    AC       18 ms   9 MiB  Output: 3
Task: 4ad495cd-41fd-46ab-a0c4-0757e0a2a43a
```

表格使用集中管理的无边框布局，按 Unicode 显示列宽对齐和截断，保留组合字符与 emoji 序列。终端宽度由 `COLUMNS` 或终端检测确定，无法检测时使用 80 列。窄屏将资源列表改为字段视图，评测优先保留编号和结论；`--plain` 提供不截断的纯文本视图，脚本解析仍使用 JSON/JSONL。

`--color auto|always|never` 控制 human 样式，`--no-color` 等价于 `--color never`；显式 `always` 在支持样式的终端覆盖 `NO_COLOR`，管道、JSON/JSONL、`TERM=dumb` 始终无 ANSI。仅当 stdout 和 stderr 都是终端时显示动态进度，`CI`、`--quiet`、`--plain`、`TERM=dumb` 都可关闭进度。`--plain` 与显式 JSON/输出格式互斥。详细设计和可重复的终端捕获方法见 [CLI 展示设计](cli-ux.md)。

| 退出码 | 含义 |
| --- | --- |
| 0 | 操作成功；全部测试 accepted；对拍未发现差异 |
| 1 | 已完成评测但存在 WA/TLE/MLE/OLE/RE/PE/部分正确等结论；对拍发现差异；全量索引重建部分失败 |
| 2 | 参数、文件、索引、任务状态错误，或同一 store 正被其他执行进程占用 |
| 3 | 编译或语法检查失败 |
| 4 | 任务总超时、等待超时、编译器/运行器无法启动、评测器故障、内部操作或输出失败 |
| 130 | 当前评测或等待被取消/中断 |

`task get`、`history load` 等查询命令成功读取记录时退出 0，即使记录本身为 failed/canceled；`task wait` 使用被等待任务的评测退出码。正常取消请求与 `--wait` 确认取消成功均退出 0。

## 实现与验证

错误码、方法枚举、400 行文件限制与 100 行函数限制见 [代码质量约定](quality.md)。

- `interface/cli` 负责参数、文本文件输入、输出格式和命令生命周期；`interface/rpc` 负责 RPC 协议和传输。
- `application/commands.rs` 及其子模块和 `application/models.rs` 由两个入口共用；`infrastructure/kernel.rs` 统一装配各个 port 的实现。
- `tests/cli_integration.rs` 及其子模块使用真实二进制验证命令、退出码、stdin、数据 CRUD、移动、历史、SPJ/交互/对拍、临时覆盖、信号与跨进程取消。
- `tests/rpc_integration.rs` 及其子模块包含 CLI 查询/取消常驻 RPC 任务的兼容性测试；已有任务、索引、资源限制和插件 RPC 测试继续回归。

本次已构建 Linux x64 release 内核并生成 `packages/vscode-ext/cph-ng-0.7.11.vsix`；已验证 VSIX 中内核与 release / bin 文件 SHA-256 一致、Unix 可执行权限保留、旧 router.cjs 不再打包。70 项 Rust 测试、182 项 VS Code 测试通过；详细边界和跨平台验证范围见 [architecture.md](architecture.md)。

## 错误与强制参数

错误码由 application 统一定义：无效参数/配置 `-32602`，未索引源码 `-32001`，冲突/重复 ID/已存在目标/未确认有损导出 `-32002`，不存在的题目/样例/文件 `-32003`，占用 `-32006`。不存在的样例不再与重复 ID 都返回参数错误；重复选择同一测试点会明确拒绝。`tc update` 必须显式给 `-t/--testcase-id`，不会因漏写而创建或修改其他样例。

| 操作 | 确认及写入规则 |
| --- | --- |
| 有损 export | 先 `--dry-run` 查看 losses；实际导出必须 `--force`，否则无文件写入 |
| 原生无损 export | 无需 force；输出路径必须尚不存在 |
| create/import/link/move | 新建目标拒绝覆盖；force 不能绕过路径、大小、格式和身份校验 |
| config init | 已存在返回 created:false，保留文件 |
| config set/update/delete | 命令及明确目标本身表达修改/删除意图，不额外要求 force；配置校验失败保留旧内容 |

`--force` 只接受已报告的格式损失；它不是全局开关，也不等于“忽略错误”或“覆盖任意文件”。旧插件 ZIP 解压和迁移流程尚未完全遵守内核规则，详见迁移审计，不能把本表当成旧插件所有文件操作的保证。


## 主源码、关联源码和索引重建

`problem list` 的 `Sources` 是题目关联的源码数量（包含主源码及已失效路径），`Primary source` 只显示主源码路径。`problem sources SOURCE` 或 `problem sources --problem-id UUID` 列出全部绑定，并用 `Primary` / `Linked` 区分身份。列表不会因为新增关联而替换主源码。

- 同一道题新增另一份解答：`problem link --problem-id UUID --destination alternative.cpp`。`--destination` 是要关联的已有文件；位置参数 SOURCE 和 `--problem-id` / `--code-id` 都用于选择已有题目，三者互斥。关联源码共享测试点和设置，但使用各自的源码身份和运行历史。
- 源码已经在外部移动：`problem move --problem-id UUID --destination main.cpp --rebind-only`。它保留原源码身份和历史；移动某个关联源码时可用 `--code-id` 精确选择。不要把新增关联当作迁移原身份。
- `index rebuild` 只检查已经登记的路径，不会扫描当前目录或搜索移动后的源码。human 输出区分全部成功、部分失败和全部失败，逐项显示路径与原因；空冲突/失败列表和协议字段不再作为 human 字段输出。JSON/JSONL 保留原字段、任务状态和退出码；部分失败仍退出 1。

未索引源码的错误提示会分别给出新建题目、关联已有题目、迁移源码三个入口；不会默认引导用户把已有题目重复创建。

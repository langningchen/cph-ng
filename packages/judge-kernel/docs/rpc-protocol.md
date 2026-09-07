# Judge kernel RPC protocol 1.0

独立前台命令、文件输入和退出码见 [CLI 使用说明](cli.md)。两个入口共用 application commands 和任务/历史存储。内核使用 `Method`、`EventMethod`、`ErrorCode` 枚举集中声明协议值，JSON 中的方法名称和数值错误码保持兼容；规则见 [代码质量约定](quality.md)。

## 启动与生命周期

```sh
cargo build -p cph-ng-judge
cph-ng-judge serve --transport stdio --store-root /path/to/store --workspace-root /path/to/workspace
cph-ng-judge serve --transport unix --socket /path/to/kernel.sock --store-root /path/to/store
cph-ng-judge serve --transport pipe --pipe '\\.\pipe\cph-ng' --store-root C:\cph-store
```

同一 store 只允许一个执行进程（RPC 服务或 CLI 写入/评测命令）；CLI 查询和取消可以并行访问，且不会恢复仍由其他进程持有的活动任务。Unix socket 的权限为 `0600`，服务器持有 store 锁后仅清理拒绝连接的残留 socket，不覆盖正在监听的 socket 或普通文件；Windows pipe 拒绝远程客户端，使用系统 ACL。每个连接均收到 `event.server.ready`，能力应通过 `system.capabilities` 查询。

stdio 的 stdout 只包含 JSON Lines；日志写入 stderr。JSON-RPC 通知执行但不返回响应，支持字符串/整数/null ID，以及最多 128 项的 batch。无效 JSON 返回 `-32700`，无效请求 `-32600`，未知方法 `-32601`，无效参数 `-32602`。

Unix socket / named pipe 客户端断线后任务继续运行；重连后查询任务或补读事件。stdio 是单个调用方拥有的子进程模式：stdin EOF、Ctrl-C、SIGTERM 或 `system.shutdown` 会取消活动任务，提交最终状态与历史，再关闭连接。进程意外终止后，重启会把遗留的 queued/running 任务标记 canceled 并补写最终事件。

VS Code 使用同一 store 的共享 socket/pipe 服务，关闭窗口只断开连接。`system.attach` 接收 `{workspace_roots:["/absolute/workspace"]}`，原子校验并添加本机客户端选择的工作区；返回允许根列表。符号链接按规范路径检查，根必须为现有目录。挂载新目录不重启服务，也不取消其他窗口的任务。共享服务常驻到 shutdown 或信号；stdio 的调用方所有权规则保留。

## 配置与工具链

| 方法 | 参数与返回 |
| --- | --- |
| `config.get` | 可选题目引用；返回 `path,sources,config,toml,raw_toml,local_config`，其中 config/toml 为有效值，raw_toml/local_config 为本层内容，path 为本层文件路径，sources 为启用的配置来源 |
| `config.set` | 可选题目引用；提供 `toml` 或对象 `patch`，二者互斥；可提供 `expected_raw_toml`，内容已变化时返回 Conflict；校验后原子保存并返回更新后的快照 |
| `config.init` | 可选题目引用；仅初始化不存在的文件 |
| `toolchain.detect` | 可选 `language`；返回 `{toolchains:[{language,kind,path,name,version,description,group}]}` |
| `toolchain.check` | `language,kind,path`；kind 为 compiler/interpreter；识别成功返回对应工具链项，否则 null |

配置按 defaults → global → problem → CPH_ 环境逐字段合并。`patch` 的 null 删除本层字段，恢复继承。新增 `[judge]` 支持 checker_mode、tolerance、output_limit_bytes、iterations 与 legacy_comparison；每次任务录入时冻结有效配置到 `effective_config`，配置变更只影响新任务。配置服务由 CLI/RPC 共用，不缓存旧 TOML。

工具链检测在内核运行主机执行，最多 64 候选、4 个并行探测，每次进程最多 1.5 秒和 16 KiB 输出；不通过 shell，也不自动修改配置。C/C++、Rust、Python、JavaScript、Java 均使用同一接口。

完整设置页、旧设置迁移、浏览器配对、Rust 网关与远程环境说明见 [职责与通信设计](architecture.md)。

## 题目与测试点

题目引用使用 `{"problem_id":"UUID"}`、`{"source_path":"absolute path"}` 或 `{"code_id":"UUID"}`。同时提供引用时必须一致。`id` 是题目 ID；每个关联源文件有独立的 `code_id`，`sources` 列出 `{problem_id,code_id,source_path}`。仅提供 problem_id 时选择主源码；评测与单源码历史查询应提供 source_path 或 code_id。通过 ID 可读取或删除源文件已丢失的题目。

| 方法 | 参数与返回 |
| --- | --- |
| `problem.list` | 返回题目摘要数组；测试点详情通过 load/list 获取 |
| `problem.load` | 题目引用；返回题目及测试点内容 |
| `problem.create` | `source_path`, 可选 `name`, `source_code`, 题目配置；提供 source_code 时只创建不存在的文件 |
| `problem.update` | 题目引用；可选 `name`, `url`, `time_limit_ms`, `memory_limit_mb`, `checker`, `interactor`, `generator`, `brute_force` |
| `problem.delete` | 删除题目数据与索引，保留源文件及独立运行历史 |
| `problem.move` | 题目引用、`destination`；编辑器先移动/复制源文件，再重新绑定同一 UUID |
| `problem.import` | `input` 为原生/Companion/旧格式路径；原生还需 `destination` 新目录，Companion 需 `source_path`；也可使用 `document` JSON 或原有 inline `problem` |
| `problem.export` | 题目引用、`destination`、`format: native\|companion\|prob\|bin`（默认 native）、`force`、`dry_run`；结果含 `losses`, `written` |
| `problem.link` | 题目引用、`destination` 为另一份已有源码；返回新 code_id，与原题共享样例和配置 |
| `problem.sources` | 题目引用；返回所有关联源码及各自 code_id |
| `testcase.list` | 题目引用；返回 `{id,stdin,answer}[]`，stdin/answer 是内容，不是文件路径 |
| `testcase.add` | 题目引用、可选 `stdin`, `answer`, `testcase_id` |
| `testcase.update` | 题目引用、`testcase_id`、可选 `stdin`, `answer` |
| `testcase.delete` | 题目引用、`testcase_id` |
| `testcase.reorder` | 题目引用、`testcase_ids`；必须恰好包含全部 ID，不允许重复或缺失 |

`url`、`checker`、`interactor` 可设为 null 清除；清除 generator 或 brute_force 会清除压力测试配置。所有 RPC 文件读取都受 store root 与启动时或 `system.attach` 添加的 workspace roots 约束，符号链接经过规范化检查。测试点内容、题目元数据保存在 SQLite，并在同一事务中保存；写入失败保留原有记录。每题输入与答案总量最多 16 MiB，旧格式文件及 `.bin` 解压后内容也各限 16 MiB；原生包文件最多 128 MiB。大型包用 `input` 路径导入，不放进有消息大小限制的 RPC 请求中。运行用输入文件由内核在 store 中生成。

Companion 示例：

```json
{"jsonrpc":"2.0","id":1,"method":"problem.import","params":{"source_path":"/workspace/main.cpp","format":"companion","problem":{"name":"A + B","timeLimit":1000,"memoryLimit":256,"tests":[{"input":"1 2\n","output":"3\n"}]}}}
```

## 评测与任务

`judge.run`、`testcase.run_all`、`testcase.run`、`stress.start` 和 `index.rebuild` 在完成参数校验后立即返回 `{task_id,state:"queued",...}`。判题结论与任务状态分开：错误答案是成功完成的评测任务，编译器/评测器故障是 failed。

评测参数为题目引用，加上可选的 `testcase_ids`、`checker_mode`（tokens/exact/float/legacy）、`tolerance`（默认 `1e-6`）、`output_limit_bytes`。单点运行必须提供 `testcase_id`。压力测试另接收 `iterations`（默认 1000，最多 1,000,000）和 `seed`；生成器的第一个参数为当前 seed。发现差异时自动保存测试点，并在结果中返回 `testcase_id`、`input`、`answer`、`seed`。

评测还可传入临时 `stdin` / `answer` 字符串（合计最多 16 MiB），未提供的一侧视为空；不能与测试点 ID 选择或对拍混用。单次运行可覆盖资源限制及辅助程序字段，覆盖值不会持久化；对拍仅保存反例。没有临时输入且题目没有测试点时返回参数错误。

`legacy` 模式保留旧插件的空白比较行为，另接受 `legacy_comparison:{ignore_stderr,regard_pe_as_ac,output_ratio_limit}`。比较选项统一从内核配置读取；请求只传本次显式覆盖。默认仍为 tokens。

所有长任务可携带 `client_request_id`。相同键与相同参数返回原任务，即使服务已重启；同一键用于不同参数会报错。

| 方法 | 参数 |
| --- | --- |
| `task.list` | 无参数，返回 queued/running 任务 |
| `task.get` | `task_id` |
| `task.cancel`, `judge.cancel`, `stress.stop` | `task_id`；返回当前状态，等待最终 canceled 事件确认进程已停止 |
| `task.events_since` | `sequence`（默认 0）、可选 `task_id`、`limit`（最多 1000） |
| `history.list` | 可选题目引用、`limit`（最多 100）、`offset`；返回摘要 |
| `history.load` | `run_id`（等于 task_id）；返回完整结果、源代码快照与 SHA-256 |

状态为 queued/running/succeeded/failed/canceled。任务、结果及历史使用 `schema_version:1`。事件的 `sequence` 全局单调递增并保存在 SQLite；按返回的最后一个 sequence 分页补读。

事件包括 `event.task.queued`、`event.task.started`、`event.task.progress`、`event.task.finished` 和 `event.server.shutting_down`。慢客户端可能收到 `event.server.events_lost`，此时调用 `task.events_since` 补齐。事件广播前对应事务已经提交。最终任务结果的 testcase 项包含 `testcase_id`, `verdict`, `time_ms`, `memory_mb`, `stdout`, `stderr`, `exit_code`, `message`。

## 编译器、SPJ 与交互评测

注册的语言为 C/C++、Python、Rust、JavaScript、Java。编译器和解释器可通过 `store/config.toml` 或 `store/problems/<UUID>/config.toml` 的 `[languages.<language>]` 配置，参考 `assets/default_config.toml`。配置使用可执行路径与参数数组，内核不经过 shell 执行。VS Code 设置页通过 config RPC 编辑这些文件，插件不直接生成或覆盖 TOML。

Python 与 JavaScript 在运行前执行语法检查，语法错误返回编译失败。顶层 `compilation_timeout_ms` 可覆盖默认编译时限。

评测和对拍参数支持 `compilation: "auto" | "skip" | "force"`（默认 `auto`）。`auto` 校验并复用 `STORE/cache/compilation` 的编译/语法检查缓存；`skip` 没有有效缓存时返回编译失败；`force` 重新编译并更新缓存。该选项同时作用于解答及所有辅助程序。缓存校验包含源码、语言配置、工具链版本、相关环境变量、C/C++ 和 Rust 编译器报告的依赖文件及产物内容；未报告的外部链接库或 Java classpath 内容变化需要 `force`。每次运行仍保存独立的源码和产物快照。结果新增 `compilation: {hits, builds}`，进度事件 `compiled` 携带同一统计。

普通评测默认比较空白分隔的 token。SPJ 接收 `<input-file> <actual-output-file> <answer-file>`；退出码 0/1/2/7 分别表示 accepted/wrong_answer/presentation_error/partially_correct，其他退出码或资源超限返回 `-32012`。

交互器接收 `<input-file> <transcript-file> <answer-file>`，双方 stdin/stdout 互连。任一方超时、超限或被取消时终止双方进程树。交互器遵循 testlib 的 0/1/2 退出码约定，异常退出返回 `-32012`。同时配置 checker 时，将交互器写出的 transcript 文件作为 checker 的实际输出。

## 索引

按已登记的规范路径、设备/inode（Windows volume/file ID）、xattr（Windows NTFS ADS）、SHA-256 逐层查找。其他路径的匹配仅在候选唯一且旧路径已不存在时自动恢复为移动；原路径仍存在的副本/硬链接返回 `-32002`，不会改走原索引。多个候选也返回 Conflict；无匹配返回 `-32001`。显式 `problem.link` 建立共享关系并分配新 code_id，`problem.create` 建立独立题目；明确的 `problem.move` 可以重新绑定指定 code_id。详见 [源码身份规则](exchange.md#复制移动和索引)。

`index.reindex_file` 需要 `source_path` 和已存在的 `problem_id`。`index.rebuild` 不带参数时重建全部已知关联源码的索引，也可指定这两个字段。重建结果包含 rebuilt、conflicts、failures。

## 默认资源限制

| 资源 | 默认值 / 配置 |
| --- | --- |
| 并行评测 | 2；`--workers` |
| 并行压力测试 | 1；`--stress-workers`，同时受总 worker 限制 |
| 活动及排队任务 | 128；`--max-tasks` |
| 总任务时长（包括排队） | 300 秒；`--task-timeout-ms` |
| 单次编译 | 30 秒、2048 MiB；`compilation_timeout_ms` 可配置 |
| 编译产物单文件 | 128 MiB，与 stdout/stderr 限制独立 |
| 源代码快照 | 16 MiB |
| 每题输入与答案总量 | 16 MiB |
| 单点运行 | 题目配置；默认 1000 ms、256 MiB |
| stdout + stderr | 单进程合计 1 MiB；RPC 可配置，最多 16 MiB |
| 单次普通评测累计输出 | 8 MiB |
| 消息输入 | 4 MiB；`--max-message-bytes` |
| 每连接并发请求 | 32；`--max-requests`，每请求最多 30 秒 |
| socket / pipe 连接 | 32 |
| 进程数 | 单次运行 64，编译 128 |
| 关闭等待 | 5 秒；`--shutdown-grace-ms` |

内存与进程数量通过进程树采样监督；Linux 还通过 prlimit 限制单个输出文件大小与 core dump。memory_mb 是采样所得峰值，不能等同于精确内核资源计量。平台支持情况以 capabilities 为准。

错误码另外包括：`-32003` 任务/历史不存在、`-32004` 取消或不可取消、`-32005` 不支持的语言、`-32006` 队列已满、`-32010` 编译失败、`-32011` 运行或总任务资源错误、`-32099` 内部错误。

## VS Code 集成与验证

插件默认使用 `bin/<platform>-<arch>/cph-ng-judge[.exe]`，支持 `cph-ng.kernel.executablePath` 或 `CPH_NG_JUDGE` 指定开发用内核。`pnpm -C packages/vscode-ext build:kernel` 构建本机内核；CI 在 Linux、Windows、macOS 构建并把各平台二进制合并到通用 VSIX。

现有题目与测试点界面继续工作，评测和压力测试委托 RPC；`CPH-NG: Show Judge History` 命令读取 SQLite 历史。旧压缩 JSON 的迁移、文件选择、模板、webview 和 Companion 网关保持兼容。重复的 TypeScript 编译、判题、runner 和 evaluator 已移除；语言模块只保留 Rust 工具链 RPC 的界面适配。展开/禁用选择按题目 UUID 保存在插件本地状态，编译覆盖由 Rust 管理。Companion 网关由同一 Rust 二进制的 `router` 子命令运行，替代原 Node `vscode-router`。

```sh
cargo test --locked -p cph-ng-judge
cargo clippy --locked -p cph-ng-judge --all-targets
cargo fmt --all --check
# 构建内核后在插件目录运行，CPH_NG_JUDGE 指向构建出的可执行文件：
CPH_NG_JUDGE=/absolute/path/cph-ng-judge pnpm -C packages/vscode-ext test:run
pnpm typecheck
pnpm -C packages/vscode-ext compile
```

Linux 本地测试覆盖真实 stdio/Unix socket、信号退出、进程树取消、内存/时间/输出限制、普通/SPJ/交互/压力评测、索引优先级与冲突、异常重启恢复及 TypeScript ↔ Rust 联调。Windows named pipe 用例配置在 Windows CI 执行；本机没有进行 Windows/macOS 原生验证。Java 需要可用的 JDK；本机实际执行的语言为 C/C++/Rust/Python/JavaScript。

## 导出与源码历史

`problem.export` 的 `dry_run:true` 返回将损失的字段而不写文件。兼容格式不能保存题目/源码身份等数据，必须明确 `force:true`；否则返回 Conflict，`error.data.losses` 列出损失。`force` 不允许覆盖文件或突破路径约束。导出和原生导入目录受现有 PathPolicy 约束。

`history.list` 按 `source_path` 或 `code_id` 查询独立源码历史；按 `problem_id` 则汇总整题，省略引用查询整个 store。TaskInfo 新增可选 `code_id`，旧数据迁移到原来的主源码身份。源码丢失或题目删除后仍可通过 `code_id` 读取持久历史。原生导入重映射所有本地身份，同时保留源码与历史对应关系及来源 ID 映射；不创建可执行的活动任务。完整格式约定见 [导入导出格式](exchange.md)。


CLI 的文本参数规范为 `--input-text` / `--answer-text` 和 `--input-file` / `--answer-file`；JSON-RPC 的 `stdin`、`answer` 字段保持不变。样例 update/delete/run 找不到 ID 返回 NotFound (`-32003`)，add 重复 ID 返回 Conflict (`-32002`)，重复测试点选择返回 InvalidParams (`-32602`)。这些分类与 CLI 共用 application 层。

路由凭据通过本机 CLI `config --scope router` 管理，保存在独立 `router/config.toml`，不进入 `config.get` 的评测配置或题目交换包；浏览器网关仍不开放配置修改 RPC。


### 并发评测与行内差异（可选扩展字段）

`judge.run`、`testcase.run` 和 `testcase.run-all` 接受 `jobs`（1–256，默认 1）；实际并发取可用 CPU 数一半、4 和选中测试点数的最小值，至少为 1。`stress.start` 仅支持 `jobs=1`。同一内核进程内共享执行名额，串行任务独占名额；墙钟计时不包括等待名额，仍可能受外部负载影响。

普通评测结果新增 `jobs`（实际并发数量），测试点结果新增可空 `comparison`（按检查策略生成的首个差异说明）。进度可包含 `preparing`（带编号和 ID 的 `testcases` 列表）、`scheduled`（`jobs`、`total`）；`running` 和 `testcase_finished` 增加从 1 开始的 `case_index`。并发完成事件可乱序，最终 `testcases` 始终按选中测试点原顺序排列。JSONL 仍保留全部事件，终端刷新节流不影响事件持久化。

CLI 的 `diff RUN_UUID --case N` 为本地历史查看功能，读取该运行保留的答案快照，不增加 RPC 方法。

源码绑定新增 `role: "primary" | "linked"`，表示当前有效默认源码。按问题 ID 加载/评测以及 `problem.list` 优先选择原绑定（`code_id == problem_id`）；若它不是可读普通文件，则按首次绑定时间、Code ID 的稳定顺序选择可用关联源码。原文件恢复后重新优先选择原绑定；全部不可用时保留原绑定用于诊断。选择不修改任何 ID、绑定或历史。明确指定路径或 Code ID 时不回退。调用方应读取 `role`，不再用两个 ID 相等来判断当前 Primary。

任务事件的 `kind` 和进度 `phase` 在内核中使用闭合枚举，并验证各阶段的字段。原有 JSON 表示不变，包括索引重建进度的 `{ "rebuilt": N }`（无 `phase`）；未知事件类别、阶段或评测 verdict 不会被当作有效内部状态接受。

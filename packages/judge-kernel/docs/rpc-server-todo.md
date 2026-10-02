# RPC Server TODO

Implementation completed on 2026-09-05. See [the protocol and operating guide](rpc-protocol.md) and [the plan's implementation record](rpc-server-plan.md#15-实施结果2026-09-05).

## Protocol and lifecycle

- [x] JSON-RPC 2.0 DTOs, standard errors, protocol versions and capabilities
- [x] Resident stdio JSONL server, clean stdout and `event.server.ready`
- [x] `system.hello`, `system.ping`, `system.capabilities`, `system.shutdown`
- [x] Bounded requests, connections, input frames, event queues and slow-client handling
- [x] Graceful shutdown, process-tree cancellation and durable final task events
- [x] Unix socket and Windows named pipe transports with local access restrictions

## Problems, indexes and testcases

- [x] Problem list/load/create/update/delete/move
- [x] `problem.import`: Companion, legacy `.prob` and gzip `.bin`
- [x] Index resolve/reindex and asynchronous rebuild with conflict/failure reporting
- [x] Stable identity through xattr/NTFS ADS, filesystem IDs and content hash
- [x] SQLite schema migration and canonical workspace paths
- [x] Testcase list/add/update/delete/reorder with atomic metadata/content writes
- [x] Import size limits, duplicate/order checks and allowed-root validation

## Judging and tasks

- [x] Durable task create/get/cancel, idempotency and queued/running/final states
- [x] Task event history, monotonic sequences and `task.events_since`
- [x] `testcase.run`, `testcase.run_all`, `judge.run`, `judge.cancel`
- [x] C/C++/Rust compilation, Python/JavaScript syntax checks, Java compilation/runtime
- [x] Token/exact/float checking and compatible VS Code comparison settings
- [x] SPJ and interactive evaluation, including an interactor combined with a checker
- [x] `stress.start`, `stress.stop`, reproducible seeds and saved failing testcases
- [x] SQLite task/history results, source snapshots, hashes and interrupted-task recovery
- [x] Worker/stress/per-problem limits, task/compiler/runtime timeouts and cancellation propagation
- [x] Bounded stdout/stderr, compiler artifacts, testcase data and cumulative task results
- [x] Process-tree memory/process-count supervision and platform capabilities
- [x] DTO/domain separation and application ports for repositories, compilers, executors and checkers

## VS Code migration and delivery

- [x] JSONL RPC client with startup handshake, correlation, timeouts and structured errors
- [x] Reconnect, task idempotency, event replay, cancellation and shutdown
- [x] Route problem/testcase/judge/stress/history actions through the Rust kernel
- [x] Persist editor testcase preferences and compiler overrides by stable problem identity
- [x] Keep legacy data import, toolchain discovery, templates, webview and Companion gateway compatible
- [x] Remove duplicate TypeScript compiler/judge/runner/evaluator code and unused ports
- [x] Native binary discovery, executable override, release build and VSIX packaging
- [x] Linux/Windows/macOS CI builds, Rust tests and TypeScript-to-Rust integration tests
- [x] Integration tests for protocol, import, persistence, limits, cancellation, indexing and migration
- [x] Update operating instructions, protocol reference and implementation status

## Verification

- Linux: 42 Rust tests after strict linting and terminal output improvements, plus 4 release packaging tests. Earlier RPC and CLI phases also verified the VS Code client against the real kernel.
- Workspace TypeScript check, Biome check, translation checks, Rust formatting and Clippy.
- Production builds for the extension, webview and independent router; release kernel and local VSIX.
- Windows named pipe has a platform-gated integration test; native Windows/macOS execution is configured in CI and was not run on the Linux development host.

Daemon management, TCP loopback and moving the Companion gateway to Rust remain conditional future options in PLAN, not unfinished first-version requirements.

## 独立 CLI 补充（2026-09-05）

- [x] 提取共享 application commands / models，CLI 直接运行内核且不依赖 RPC 服务
- [x] `run` / `judge run`、单点/全部测试、SPJ、交互和对拍前台入口
- [x] 题目、测试点、导入、索引、历史、任务和配置的完整命令组
- [x] 文件/文本/stdin 输入、临时测试点、单次配置覆盖及反例保存
- [x] human / JSON / JSONL 输出、编译诊断和明确的退出码
- [x] store 所有权锁、观察模式和 CLI ↔ CLI / RPC 跨进程取消
- [x] Ctrl-C/SIGTERM、阻塞 stdin 中断、进程清理及最终事件/历史提交
- [x] 保留原 import/config/index 命令语法，更新 CLI/RPC 操作说明
- [x] 真实二进制 CLI 集成测试，以及共享应用层的 Rust / TypeScript RPC 回归

本阶段本机验证：33 项 Rust 测试（10 CLI、14 RPC、9 任务/索引）、6 项扩展 RPC 测试（包含真实内核）、Rust fmt / Clippy 和 release 构建。CLI 说明见 [cli.md](cli.md)。此前 172 项扩展全量测试的结果保留在上一阶段记录中；本阶段未改动 TypeScript 生产代码。Windows/macOS 原生执行仍由既有 CI matrix 验证。

## 无交互 CLI 与跨平台发布（2026-09-05）

- [x] 删除 `--ci` / `--yes` 和 Inquire port / adapter；终端与管道使用相同规则
- [x] 旧格式导入越界时直接返回参数错误，不确认、不截断、不写入题目
- [x] 用 `config init` / `config set --input` 替代 `config edit`，不启动编辑器
- [x] 配置初始化不覆盖已有文件，替换前检查 TOML、大小和资源范围
- [x] 切换到 stable Rust，删除未使用的直接依赖并更新 Cargo.lock
- [x] 五个平台的原生构建矩阵，独立标签发布归档、构建信息和 SHA-256
- [x] 手动工作流仅构建；正式发布校验版本、全部目标、校验和并沿用 production 环境
- [x] VSIX 打包使用全部预构建内核，防止覆盖原生 runner 的产物
- [x] 终端无确认、配置替换、发布包结构、版本不符和校验和篡改的回归验证
- [x] 更新 CLI、发布操作说明和 PLAN / TODO

本阶段 Linux 验证：35 项 Rust 测试（12 CLI、14 RPC、9 任务/索引）、6 项扩展 RPC 测试、4 项 Python 发布测试；Rust fmt / Clippy、actionlint 和 stable release 构建通过。该阶段保留的 Clippy 风格与文档告警已在下述严格检查阶段清零。Windows/macOS 和 Linux ARM64 已配置原生 CI，未在此 Linux x64 主机执行。发布流程见 [releasing.md](releasing.md)。

## 严格 Clippy、类型约束与终端展示（2026-09-06）

- [x] 修复生产与测试全部 Clippy 告警，删除原测试的宽泛 lint 放行
- [x] CI 与独立发布工作流加入 `-D warnings`，覆盖全部 Cargo targets
- [x] 统一 `ErrorCode` / `CommandError`，任务错误与 RPC 错误复用类型
- [x] 用 `Method` / `EventMethod` 替代内核内散落的方法名，保持 wire 名称与未知方法错误语义
- [x] 集中声明 `ExitStatus`，在可执行入口转换为既有进程退出码
- [x] Clippy 函数预算 100 行；Rust 文件预算 400 行并加入实际 CI 检查
- [x] 按职责拆分命令、任务、评测、编译、导入、CLI 和大型集成测试
- [x] 终端彩色结论、明确进度、通过数量、诊断与完整反例信息
- [x] 保持 pipe / JSON / JSONL 与无交互契约，遵守 `NO_COLOR` / `TERM=dumb`
- [x] 真实伪终端回归、协议类型兼容回归与完整 Rust 集成回归
- [x] 更新 CLI、RPC 与代码质量说明，重新构建 release

Linux x64 完整回归：42 项 Rust 测试；Linux / Windows GNU 交叉目标严格 Clippy 均零告警，全部 Rust 文件不超过 400 行。Windows/macOS 原生运行继续由 CI matrix 验证。此前阶段保留的 Clippy 告警已在本阶段清零，规则见 [quality.md](quality.md)。

- [x] VS Code RPC 方法/通知/错误码集中声明，请求入口强类型，保留未知远端错误透传
- [x] 7 项客户端 RPC 回归、TypeScript 构建与 RPC 目录 Biome 零告警

## 配置、工具链与网关归属迁移（2026-09-06）

- [x] CLI/RPC 共用配置服务、逐字段继承、原子保存与运行配置快照
- [x] Rust 工具链探测/检查和全局/题目设置 Webview
- [x] 移除每次保存题目时由 VS Code 生成 TOML 的逻辑，显式迁移旧设置
- [x] Unix socket / named pipe 多窗口共享内核和动态工作区注册
- [x] Rust WebSocket/HTTP Companion 网关、配对与原子批次认领
- [x] 浏览器与 VS Code 改用标准 WebSocket，移除 Node router 包
- [x] 紧凑 human 输出，保留 JSON/JSONL 与退出码

现行边界、兼容范围和通信说明见 [architecture.md](architecture.md)。前文保留已完成阶段的历史记录；其中“保留 TypeScript 工具链发现”和“Node router 独立运行”已由本阶段替代。

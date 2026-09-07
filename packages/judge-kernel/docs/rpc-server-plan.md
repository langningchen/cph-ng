# Rust 常驻 RPC 服务器规划

## 1. 文档目的

本文为 `judge-kernel` 规划一个由 Rust 实现的常驻 RPC 服务器。服务器用于承载竞赛题目管理、编译、运行、评测、测试点操作、压力测试和索引管理等核心能力。

本文讨论的 RPC 服务器与上层 `vscode-router` 是两个不同的服务：

- **Rust RPC 服务器**：面向 VS Code 插件或其他本地客户端，提供稳定的核心业务 API。
- **`vscode-router`**：面向浏览器端 Competitive Companion 与 VS Code 之间的 HTTP/Socket.IO 网关，继续负责浏览器协议、批次转发和浏览器连接状态。

两者不共享协议，也不应因为都使用“服务器”这个名称而合并成一个端口或一个进程。未来可以由 VS Code 插件同时连接两个服务，但 Rust RPC 请求不应经过浏览器网关。

## 2. 目标与非目标

### 目标

1. 提供一个 `serve` 命令，启动后进程常驻并持续处理 RPC 请求。
2. `serve` 默认阻塞当前进程，直到收到 `shutdown`、Ctrl-C 或系统终止信号。
3. 长时间操作（编译、评测、压力测试、批量测试点）采用任务模型：RPC 调用快速返回 `task_id`，服务器在后台执行任务。
4. 将当前 Rust 核心逻辑作为唯一业务实现，VS Code 插件逐步退化为 RPC 客户端和界面层。
5. 继续使用 SQLx + SQLite 保存题目索引、题目元数据、测试点和历史结果。
6. 题目代码的唯一身份使用三层索引解析：xattr 标记、文件系统 ID、全文哈希；三层都失败时返回可处理的“未建立索引”错误。
7. RPC 协议与终端彩色展示解耦，保证机器客户端永远收到纯结构化数据。

### 非目标

- 不把 `vscode-router` 的浏览器 HTTP/Socket.IO 协议迁移到本服务器。
- 不在第一版引入公网监听、远程执行或任意 shell 执行接口。
- 不用“后台命令返回后进程退出”的方式伪装常驻服务。非阻塞指的是请求不等待任务完成，而不是服务器进程自动退出。
- 不让路径作为题目身份。路径只能作为当前文件位置或源文件定位信息。

## 3. 推荐的总体架构

```text
VS Code RPC 客户端 / 其他本地客户端
            |
            | JSON-RPC 2.0，默认 stdin/stdout
            v
interface::rpc
  Transport -> Reader/Writer -> Dispatcher
            |
            v
application::commands / application::tasks
            |
            v
domain + ports（业务规则和抽象接口）
            |
            v
infrastructure（SQLx SQLite、索引、编译器、执行器、评测器）
```

浏览器链路保持独立：

```text
Competitive Companion 浏览器扩展
            |
            v
vscode-router（HTTP + Socket.IO）
            |
            v
VS Code 插件中的 Companion 客户端
```

`vscode-router` 仍可由插件按需启动或连接。RPC 服务器不监听它的端口，也不处理 `CompanionProblem`、浏览器 claim 或 Socket.IO room 等协议细节。插件收到浏览器题目后，再通过 Rust RPC 的 `problem.import` 命令交给核心处理。

## 4. 进程模式与命令行设计

### 4.1 常驻阻塞模式

建议新增：

```text
cph-ng-judge serve --transport stdio --store-root <dir>
```

`serve` 完成初始化后进入事件循环，不返回到 shell。它必须处理：

- RPC 请求读取和响应写入；
- 后台任务调度；
- 任务事件通知；
- Ctrl-C、SIGTERM 和显式 `system.shutdown`；
- 优雅关闭和未完成任务的取消。

VS Code 插件应以子进程方式启动该命令，并通过 stdin/stdout 连接。这样不需要分配端口、不会产生端口冲突，也不会把服务暴露给局域网。

### 4.2 非阻塞任务语义

例如 `judge.run`、`testcase.run_all`、`stress.start` 等命令只负责校验参数、创建任务并返回：

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": { "task_id": "01J...", "state": "queued" }
}
```

随后通过通知发送进度和结果：

```json
{
  "jsonrpc": "2.0",
  "method": "event.task.finished",
  "params": {
    "task_id": "01J...",
    "state": "succeeded",
    "result": { "verdict": "accepted" },
    "sequence": 7
  }
}
```

这里的“非阻塞”只保证客户端请求立即完成；任务仍由常驻服务器可靠执行。客户端断开后，任务默认继续运行，并将最终状态保存在 SQLite 的运行历史中。需要用户主动取消时调用 `task.cancel`。

第一版不建议实现 `--daemon` 或 `--detach`。若未来确实需要客户端退出后仍自动拉起服务器，再单独增加 `daemon start/status/stop`，避免把进程守护、锁文件和跨平台服务管理混入 RPC 协议本身。

### 4.3 传输选项

推荐顺序：

1. **stdio（第一版）**：JSON-RPC 2.0，按行传输 JSON。适合 VS Code 子进程，安全边界清晰。
2. **Unix domain socket（第二阶段）**：适合多个本地客户端共享一个服务器；通过 socket 文件权限限制访问。
3. **Windows named pipe（第二阶段）**：与 Unix socket 对应的 Windows 本地传输。
4. **TCP loopback（可选）**：仅监听 `127.0.0.1`，必须有随机 token 或权限文件；绝不默认监听 `0.0.0.0`。

建议 CLI 形态：

```text
cph-ng-judge serve --transport stdio
cph-ng-judge serve --transport unix --socket <path>
cph-ng-judge serve --transport tcp --listen 127.0.0.1:0 --auth-token-file <path>
```

所有传输共享同一个 dispatcher 和协议，不为不同传输复制业务逻辑。

## 5. JSON-RPC 协议约定

### 5.1 基本规则

- 使用 JSON-RPC 2.0 的 `jsonrpc`、`id`、`method`、`params`、`result`、`error` 字段。
- 请求 ID 支持字符串和整数；通知不携带 ID，不产生响应。
- stdio 使用 JSON Lines，每个请求或通知占一行；stdout 只输出协议内容，日志写 stderr 或日志文件。
- 设置最大消息大小、最大并发请求数和写入背压，避免客户端发送无限大的 JSON 或导致内存增长。
- 服务器启动后先发送 `event.server.ready`，其中包含协议版本、服务器版本和能力列表。

### 5.2 第一批方法

系统与能力：

- `system.hello`：协商协议版本和客户端能力。
- `system.ping`：健康检查。
- `system.capabilities`：返回可用语言、评测器、传输和功能。
- `system.shutdown`：请求优雅关闭；仅允许本地受信客户端调用。

题目和索引：

- `problem.list`、`problem.load`、`problem.create`、`problem.import`。
- `problem.update`、`problem.delete`、`problem.move`。
- `index.resolve`：按 xattr、文件系统 ID、全文哈希顺序解析。
- `index.rebuild`：重建索引，返回后台任务 ID。
- `index.reindex_file`：用户选择文件后手动建立或修复映射。

测试点和评测：

- `testcase.list`、`testcase.add`、`testcase.update`、`testcase.delete`、`testcase.reorder`。
- `testcase.run`、`testcase.run_all`。
- `judge.run`、`judge.cancel`、`stress.start`、`stress.stop`。

任务和历史：

- `task.get`：查询任务当前状态和最终结果。
- `task.cancel`：通过取消令牌停止任务。
- `task.events_since`：按 sequence 读取断线期间的事件。
- `history.list`、`history.load`：读取持久化评测历史。

### 5.3 错误模型

错误必须包含稳定的机器可读 code、message 和可选 data。建议至少定义：

| code | 含义 |
| --- | --- |
| `-32600` | 无效请求 |
| `-32601` | 方法不存在 |
| `-32602` | 参数无效 |
| `-32001` | 题目未建立索引 |
| `-32002` | 索引冲突或文件已变化 |
| `-32003` | 任务不存在 |
| `-32004` | 任务已取消或不可取消 |
| `-32005` | 不支持的语言或评测模式 |
| `-32010` | 编译失败 |
| `-32011` | 运行超时、内存超限或运行时错误 |
| `-32012` | 特殊评测器/交互评测器失败 |
| `-32099` | 内部错误 |

不要把 Rust 调试字符串直接当作协议错误。日志可以保留详细链路，RPC 返回稳定错误和用户可理解的摘要。

### 5.4 版本与兼容性

`system.hello` 中携带 `protocol_version` 和 `server_version`。协议采用向后兼容的新增字段策略：旧客户端忽略未知字段，破坏性变更提升主版本。每个任务结果应包含 `schema_version`，便于历史记录迁移。

## 6. 并发、任务和取消设计

服务器内部应将“读取请求”和“执行命令”彻底分离：

```text
reader -> dispatcher -> bounded task queue -> worker
                                      \-> event bus -> serialized writer
```

建议实现：

- `TaskId` 使用 UUID/ULID，不使用文件路径。
- `TaskManager` 保存活动任务、状态、取消令牌和事件 sequence。
- 使用 Tokio 的 `JoinSet` 或受控 worker 队列运行异步任务。
- 用 `Semaphore` 限制同时编译/评测数量；压力测试另设并发上限。
- 同一题目使用 per-problem 锁，避免编译缓存、测试点文件和历史同时写入产生竞态。
- 支持幂等键（如 `client_request_id`），客户端重试不会重复启动同一个评测。
- 限制 stdout/stderr、单个测试点运行时长、总任务时长和输出文件大小。
- 任务状态至少包括 `queued`、`running`、`succeeded`、`failed`、`canceled`。
- 活动任务状态保存在内存，最终状态、评测结果、运行时间和错误摘要写入 SQLite。

事件应带 `sequence` 和 `task_id`。客户端重连后可以调用 `task.events_since` 补齐事件，而不是依赖一次性的内存通知。

## 7. 生命周期与优雅关闭

启动顺序建议固定为：

1. 解析 CLI 和配置，确定 store root、传输和日志位置。
2. 初始化 tracing/logging；stdio 模式下严禁向 stdout 打日志。
3. 创建 SQLx SQLite pool，执行迁移并检查索引表结构。
4. 初始化题目仓库、编译器注册表、执行器、checker 和 `TaskManager`。
5. 绑定传输并发送 `event.server.ready`。
6. 进入请求读取循环，同时运行任务 worker 和事件 writer。

关闭顺序：停止接收新请求，广播 `event.server.shutting_down`，向活动任务发送取消信号，等待有限的 grace period，写入任务最终状态，关闭 SQLx pool 和传输。超时后记录未完成任务，并在下次启动时标记为 `failed` 或 `canceled`，不能静默丢失。

## 8. 与现有代码的模块落点

建议保持当前 Rust 分层，并新增以下边界：

```text
src/interface/rpc/
  mod.rs
  server.rs       # 生命周期、监听、shutdown
  transport.rs    # stdio/socket 抽象
  protocol.rs     # JSON-RPC DTO、错误和版本
  dispatcher.rs   # method -> application command

src/application/tasks/
  mod.rs
  manager.rs      # TaskId、状态、取消、JoinSet
  events.rs       # 事件总线和 sequence
  commands.rs     # RPC 可调用的用例编排

src/infrastructure/
  repo/           # SQLx SQLite、索引、历史
  compiler/       # 编译器和缓存
  executor/       # 进程执行、资源限制
  judge/          # checker、SPJ、interactive、verdict
  companion/      # 如需 Rust 化，仅放浏览器网关适配，不与 rpc 合并
```

现有 `ports` 继续作为 application/domain 与 infrastructure 之间的契约。RPC DTO 不应直接暴露领域实体；在 dispatcher 中完成 DTO 与 command/domain 类型的转换，避免协议字段变化污染核心模型。

CLI 增加 `src/interface/cli/server.rs`，仅负责把命令行参数转换为 `RpcServerConfig` 并调用 `interface::rpc::server::run`。`main` 仍保持薄入口。

## 9. 索引和数据库要求

索引表至少需要保存：

- 内部 `code_id`（稳定唯一 ID）；
- xattr marker；
- 文件系统设备 ID、inode/file ID；
- SHA-256 全文哈希；
- 当前路径（仅作为可变定位信息）；
- 首次发现、最后确认和冲突状态。

解析顺序必须固定：

1. 读取 xattr marker 并校验数据库映射；
2. 使用文件系统 ID 查找；
3. 计算全文 hash 查找；
4. 仍找不到时返回 `NOT_INDEXED`，让客户端选择 `index.reindex_file` 或 `problem.create`。

任何层发现多个候选都应返回冲突，而不是静默选择。路径变化只更新定位字段，不改变 `code_id`。索引重建属于后台任务，完成后发送统计、冲突和失败文件列表。

## 10. 安全边界

- stdio 模式默认视为本地受信边界，不需要额外 token；仍必须限制可执行文件和参数。
- socket 模式只允许本机地址，并使用权限受限的 socket/token 文件。
- 不提供任意命令执行 RPC；编译器和运行器只能从配置的语言注册表选择。
- 对源文件、输入、输出、进程环境和工作目录做路径规范化，禁止逃逸 store root 的文件操作。
- 编译和运行应使用超时、内存、进程数、输出大小等限制；交互评测需要单独的资源策略。
- 日志中避免写入 token、完整源代码和可能包含隐私的测试数据。

## 11. 人类 CLI 展示与 RPC 输出

RPC 永远返回 JSON，不输出 ANSI 颜色。CLI 可以增加独立的 presenter，将结构化结果转换为 human、json 或 jsonl 三种格式。

`anstream` 适合根据 stdout/stderr 的终端、管道或文件环境自动处理 ANSI 输出；`owo-colors` 适合在 presenter 层提供轻量的状态颜色，并遵守终端颜色检测和 `NO_COLOR` 等约定。它们只能存在于 CLI 展示层，不能进入 domain、application 或 RPC DTO。

参考：[`anstream` 文档](https://docs.rs/anstream)、[`owo-colors` 文档](https://docs.rs/owo-colors)。

## 12. 分阶段实施计划

### 阶段 0：协议和边界

- 定义 `protocol.rs` DTO、错误码、版本和能力结构。
- 建立 `interface::rpc` 与 `application::tasks` 空骨架。
- 为 stdio reader/writer 写协议解析测试。

### 阶段 1：可运行服务器骨架

- 实现 `serve --transport stdio`。
- 实现 `system.hello`、`system.ping`、`system.capabilities`、`system.shutdown`。
- 验证 stdout 无日志污染、Ctrl-C 可退出、坏 JSON 有标准错误响应。

### 阶段 2：题目和索引

- 暴露 problem CRUD、import、load、list。
- 暴露 `index.resolve`、`index.reindex_file`、`index.rebuild`。
- 完成 SQLite 迁移、冲突处理和手动重建索引流程。

### 阶段 3：编译和传统评测

- 将 compiler、executor、checker 接到 application command。
- 实现 `judge.run`、`task.get`、`task.cancel` 和进度事件。
- 加入超时、输出限制、并发限制和历史持久化。

### 阶段 4：测试点、压力和高级评测

- 测试点增删改排、单个/全部运行。
- SPJ、interactive、stress start/stop。
- 断线重连后的事件补偿和历史查询。

### 阶段 5：VS Code 插件瘦身

- 把插件的编译、评测、测试点和历史调用替换为 RPC client。
- 插件只保留 webview、命令注册、状态展示和 `vscode-router` 生命周期管理。
- 删除重复的 TypeScript 业务实现，并保留迁移兼容层一段时间。

### 阶段 6：可选的共享本地服务

- 增加 Unix socket/named pipe。
- 如确有需要，再实现 daemon 管理命令和 TCP loopback；默认安全策略不变。
- 评估是否把 `vscode-router` 的实现迁移到 Rust。即使迁移，也应作为独立 `companion-gateway` 二进制或独立模块，不能与 RPC dispatcher 混合。

## 13. 测试与验收标准

单元测试应覆盖协议解析、错误映射、任务状态机、取消传播、索引优先级和冲突检测。集成测试应启动真实 `serve` 子进程，通过 stdin/stdout 完成 hello、创建题目、启动任务、读取事件、取消任务和 shutdown。

第一版验收至少包括：

- `serve` 在没有请求时持续运行；
- 两个并发 RPC 请求互不阻塞，长任务调用立即返回 task ID；
- 任务完成、失败、取消均有最终事件和 SQLite 历史；
- 客户端断线后任务按约定继续或取消，重连可查询最终状态；
- xattr、文件系统 ID、hash 按顺序生效，失败时客户端能选择手动重建索引或创建新题目；
- stdout 只包含协议，日志不会破坏 JSON Lines；
- RPC 服务器不会打开或依赖 `vscode-router` 的浏览器端口。

## 14. 最终建议

第一版采用“**stdio 常驻 RPC + Tokio 后台任务 + SQLx SQLite 持久化 + 独立 Companion 网关**”。这是最适合 VS Code 子进程集成的起点：部署简单、无需端口管理、协议可测试、核心逻辑集中在 Rust，并且保留未来多客户端共享服务的演进空间。

实现顺序应先稳定协议和任务生命周期，再迁移题目/索引，最后迁移编译评测和 VS Code 界面调用。不要先把 `vscode-router` 合并进来；它的浏览器连接管理和 RPC 任务调度是两种不同的边界，分开能显著降低协议耦合和故障影响范围。

## 15. 实施结果（2026-09-05）

本计划阶段 0–5 已实现，阶段 6 的 Unix socket / Windows named pipe 也已实现。当前接口、错误码、配置和运行约定以 [RPC 协议与运行说明](rpc-protocol.md) 为准；[TODO](rpc-server-todo.md) 已逐项核对。

| 阶段 | 实施结果 |
| --- | --- |
| 0：协议和边界 | 独立 protocol/DTO/dispatcher/transport；application 通过 ports 调用存储、编译、执行和 checker，领域层不依赖 infrastructure |
| 1：常驻服务器 | stdio JSONL、hello/ping/capabilities/shutdown、通知与 batch、有界请求和事件队列、信号与 EOF 关闭 |
| 2：题目和索引 | 全部 CRUD、Companion/旧格式导入、三层身份索引、冲突处理、SQLite 迁移、后台重建、手动移动与源文件丢失后的管理 |
| 3：编译和传统评测 | 六种语言注册、Python/JavaScript 语法检查、独立编译产物限制、单点和总任务限时、进程树监督、普通与兼容比较器、持久化历史 |
| 4：高级评测和任务 | 测试点事务保存、SPJ、交互器及交互器结合 SPJ、压力测试、失败用例保存、任务幂等、事件补读与异常重启恢复 |
| 5：插件迁移 | 生产调用改为 RPC；删除重复 TypeScript 编译/判题/runner/evaluator；保留旧数据迁移和编辑器工具链发现；历史命令、编辑器偏好、原生内核构建和打包 |
| 6：共享本地服务 | Unix socket 权限 0600、Windows 本地 named pipe、共享任务与持久化事件、连接上限和 store 单实例锁 |

具体实现约定：

- stdio 的生命周期属于宿主插件，stdin EOF 会关闭服务并取消任务；socket/pipe 客户端断线时服务和任务继续。此区别落实第 4.3 节的生命周期边界。
- SQLite 是题目、测试点内容、任务、事件、历史的持久化来源。编译前记录实际使用的源代码快照和 SHA-256，写入最终状态后才广播完成事件。
- 源文件可位于启动参数声明的 workspace roots；内核创建的输入、输出、编译产物位于 store。测试数据不会被当作命令、文件路径或 shell 脚本解释。
- 内存和进程数采用进程树采样，Linux 另有单文件大小硬限制；采样峰值不声称具备操作系统沙箱级别的精确计量能力，支持范围通过 capabilities 公布。
- 编辑器展开/禁用状态和用户编译覆盖配置按题目 UUID 保存于 VS Code 本地状态。判题结果与历史仍由内核管理。旧 wrapper/hook/external runner 等选项标为弃用，编译超时与比较设置继续生效。
- 编译执行不再依赖旧 TypeScript 实现；保留的语言模块只用于编译器/解释器发现和编辑器设置。Companion 网关继续作为独立进程运行。

本地验收包括 22 项 Rust 测试、172 项 VS Code 测试（启用真实 release 内核联调），以及类型检查、翻译、Biome、Rust fmt/Clippy 和生产构建。生成的通用 VSIX 在本机包含 Linux x64 内核；CI 配置收集 Linux、Windows、macOS 原生产物后合并打包，并运行对应平台测试。Windows/macOS 的原生执行结果需要 CI runner 验证，未作为本机已通过测试报告。

Daemon、TCP loopback 和 Companion 网关语言迁移仍按原计划保留为有明确需求时再评估的选项，不改变第一版的进程和协议边界。

## 16. 独立 CLI 扩展（2026-09-05）

在常驻 RPC 之外补齐前台 CLI。命令定义、示例和退出码以 [CLI 使用说明](cli.md) 为准。

- `application/commands.rs`、`application/models.rs` 接收两个入口的业务调用；RPC dispatcher 只保留协议相关系统方法和响应封装。`infrastructure/kernel.rs` 统一组合存储、工具链、执行器及调度器。
- `run` / `judge run`、`testcase run[-all]`、`stress start`、全量 `index rebuild` 等待任务终态并返回进程退出码；题目、测试点、索引、导入、配置、历史和任务查询均有独立子命令。
- 单次评测支持文本、文件或 stdin 作为临时测试点，资源与辅助程序覆盖不写回题目。对拍只保存反例，继续保留原题目配置。
- 执行/写入命令与 RPC 服务共享 store 所有权锁；查询和取消使用观察模式，禁止异常恢复仍属于其他进程的任务。SQLite 取消请求由任务所属进程消费，终态与历史继续遵守先提交再输出的约定。
- CLI 输出分为 human、JSON 和 JSONL。SIGINT/SIGTERM 以协作方式停止读取/等待，完成已进入的元数据操作，取消并清理自身任务，补齐最终事件后退出。观察者中断不会取消其他进程的任务。
- 既有 `import --input`、`config [SOURCE]` 和 `index rebuild SOURCE --problem-id` 语法保持兼容。配置路径查询不依赖有效 TOML，查询和取消也不依赖有效工具链配置。

本阶段 Linux 验证为 33 项 Rust 测试（10 CLI、14 RPC、9 任务/索引）及 6 项扩展 RPC 测试，包含真实 TypeScript 客户端连接本次内核。格式、Clippy、release 构建同时检查。CLI 测试位于既有跨平台 Cargo CI 范围内；Windows/macOS 本地未运行。CLI 不增加 daemon/TCP/Companion 网关职责，也不需要先启动 `serve`。

## 17. 无交互 CLI 与独立内核发布（2026-09-05）

- 删除 `--ci` / `--yes` 和整个 Inquire port / adapter。命令不再根据终端状态决定是否询问；无效导入立即返回参数错误，不截断数据。
- `config edit` 替换为幂等的 `config init` 和验证后原子替换的 `config set --input FILE`；只有明确的 `-` 数据源和 RPC 才读取 stdin，命令不再读取 EDITOR / VISUAL。
- 工程使用 stable Rust。独立 `Judge kernel release` 工作流根据目标清单在 Linux x64/ARM64、Windows x64、macOS Intel/ARM64 原生执行测试和 release 构建，输出带许可证、使用文档、配置示例、构建信息和 SHA-256 的归档。
- 手动运行只上传构建 artifacts；`judge-kernel-v<内核版本>` 标签触发发布，版本取 Cargo.toml，与 VSIX 版本独立。所有目标及校验和通过后，在既有 production 环境规则下创建组件 Release，不改变仓库 Latest。
- 原 VSIX CI 同样收集五套原生内核；设置 `CPH_NG_KERNEL_PREBUILT=1` 后验证完整性并直接打包，避免在聚合产物的主机上覆盖已构建的内核。

Linux x64 验证为 35 项 Rust 测试、6 项扩展 RPC 测试、4 项 Python 打包测试，以及 Rust fmt / Clippy、工作流 actionlint 和 stable release 构建。Windows/macOS、Linux ARM64 的原生运行结果仍需 GitHub CI 验证。本次仅准备代码、工作流和本地产物，未创建标签或执行远程发布。操作步骤和平台限制见 [发布说明](releasing.md)。

## 18. 严格检查、类型约束与终端展示（2026-09-06）

- 修复生产代码与测试的全部 Clippy 告警，删除测试文件原有的宽泛 lint 放行。CI 和独立发布工作流均执行 `cargo clippy --all-targets -- -D warnings`。
- `ErrorCode` 统一业务、任务和 RPC 错误码；`Method` 统一请求名称、分发、任务类型和能力声明，`EventMethod` 统一通知名称；CLI 退出状态使用 `ExitStatus`。协议字符串、整数错误码、历史 JSON 和进程退出码保持兼容。
- 未知非空 RPC 方法在请求边界保留，返回 `MethodNotFound` 时保留请求 ID。测试覆盖既有错误对象反序列化、方法拼写拒绝和 capabilities 完整性。
- 文件预算为 400 行，函数预算为 100 行。Clippy 原生约束函数，文件长度由读取 Cargo metadata 的脚本强制检查；大文件按命令、任务生命周期、评测方式、编译命令和测试场景拆分。详见 [代码质量约定](quality.md)。
- human 输出连接终端时显示彩色状态、进度、测试点编号、通过数量、耗时/内存与编译诊断；对拍显示反例 seed、测试点 ID、输入、期望/实际输出和判定结果。遵守 `NO_COLOR` / `TERM=dumb`，保留管道和 JSON/JSONL 契约，不引入确认交互。

本阶段 Linux x64 完整 Rust 回归为 42 项（17 CLI、16 RPC、9 任务/索引），并补充真实伪终端检查。Linux 及 Windows GNU 交叉目标的严格 Clippy 检查均零告警；Windows/macOS 原生执行仍由 CI 验证。文件长度检查、Rust fmt、4 项 Python 发布包测试与工作流 actionlint 通过。独立复核发现并修复了对拍反例在终端展示中的字段遗漏。

VS Code RPC 调用端也改为统一的字面量方法类型和错误码常量，并保留未知远端错误及通知的透传。本阶段 7 项扩展 RPC 测试通过（包含真实 release 内核和方法集合兼容断言），TypeScript 构建及 RPC 目录 Biome 严格检查通过。

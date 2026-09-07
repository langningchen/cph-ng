# Rust 代码质量约定

本包的生产代码和测试使用同一套检查，不通过 `allow` / `expect` 隐藏告警。CI 与独立内核发布工作流都执行以下要求：

- 每个 Rust 文件最多 **400 个物理行**，包含注释和空行。阈值位于 `Cargo.toml` 的 `[package.metadata.quality] max-rust-file-lines`；`scripts/check_quality.py` 检查包根目录（含 `build.rs`）以及 `src`、`tests`、`examples` 和 `benches`。
- 每个函数最多 **100 行**，按 Clippy 的函数统计规则计算。`clippy.toml` 设置 `too-many-lines-threshold = 100`，Cargo lint 配置将 `too_many_lines` 设为 `deny`。
- `cargo clippy --all-targets -- -D warnings` 必须零告警，包括测试；保留 `unwrap_used`、`expect_used`、`panic`、`indexing_slicing` 等原有规则。
- 使用 stable Rust 的 `cargo fmt`，不依赖 nightly 专属格式选项。

[Clippy 的 `too_many_lines`](https://rust-lang.github.io/rust-clippy/master/index.html#too_many_lines) 约束函数体，不能设置文件总行数。文件限制因此使用独立检查，并在 `clippy.toml` 中注明对应配置位置，避免写入不生效的 Clippy 配置项。

在 `packages/judge-kernel` 执行：

```sh
cargo fmt -p cph-ng-judge --check
python3 scripts/check_quality.py
cargo clippy --locked -p cph-ng-judge --all-targets -- -D warnings
cargo test --locked -p cph-ng-judge -- --test-threads=4
```

Python 检查脚本要求 Python 3.11 及以上；CI 使用 3.12。Windows 可将 `python3` 换为 `python`。发布工作流会在每个目标平台上检查并测试，而非仅检查主机构建。

## 错误码和方法名

`application/error.rs` 是业务、任务历史和 RPC 错误码的唯一声明位置。`CommandError.code` 使用 `ErrorCode`，`TaskFailure` 与 `RpcError` 复用该结构。序列化仍输出原来的整数，例如编译失败为 `-32010`。

`application/method.rs` 声明闭合的 `Method` 枚举，以及每个方法唯一的协议名称。application 分发、CLI 调用、任务类型和 capabilities 均使用该枚举；新增方法会要求匹配分支显式处理。

```rust
let result = kernel.execute(Method::TaskList, serde_json::json!({})).await?;
let error = CommandError::new(ErrorCode::InvalidParams, "Missing source path");
```

RPC 请求在边界转换为 `RequestedMethod::Known(Method)` 或 `Unknown(String)`。未知方法保留原始请求 ID 并返回 `MethodNotFound`；不会因枚举反序列化而误报无效请求。通知方法使用 `EventMethod`。外部客户端仍发送 `task.list` 等既有 JSON 字符串。

VS Code 客户端在 `vscode-ext/src/infrastructure/rpc/protocol.ts` 中集中声明同一组方法、通知和错误码。请求入口使用方法字面量联合类型；收到的远端错误码仍允许未知整数，以兼容未来内核。真实内核集成测试检查客户端声明与 capabilities 方法集合一致。

CLI 的进程退出码集中在 `interface/cli/exit.rs` 的 `ExitStatus`；仅可执行入口转换为整数，退出码含义保持兼容。

## 模块拆分

- `application/commands/`：题目、测试点、索引、导入、评测及任务命令。
- `application/tasks/`：任务类型、取消与互斥、上下文、worker、生命周期。
- `application/judge/`：单测试点评测与压力测试；编译器命令组装位于 `infrastructure/compiler/`。
- `interface/cli/operations/`：参数转换、输入、导入、移动、运行、任务与等待。
- `interface/cli/output/`：终端展示和重定向后的纯文本展示；协议输出不经过终端渲染。
- `tests/cli_integration/`、`tests/rpc_integration/`、`tests/tasks_and_index/`：按行为场景拆分，保留真实子进程、数据库和编译执行测试。共享 JSON 检查会在字段缺失或类型错误时报告字段路径。

超过阈值时应按职责提取模块或函数，避免压缩代码行、降低阈值检查强度或对特定文件豁免。


CLI 参数解析和业务错误使用同一 JSON/JSONL envelope。文件错误按 NotFound、Conflict、InvalidParams 或 ExecutionFailed 分类；内部程序/数据库异常才使用 InternalError。动态补全与应用操作隔离：不能调用会初始化数据库、恢复任务或更新 xattr 的 Kernel/ProblemIndex 入口。补全测试使用真实 fish 与 SQLite，验证当前题目限制、前缀/多选、只读和缺失/损坏 store 降级。

VS Code 剩余迁移和旧流程错误处理差异见 [迁移审计](migration-audit.md)。

任务事件使用 `TaskEventPayload` 和 `TaskEventKind`，进度入口只接受闭合的 `TaskProgress` 枚举。测试点结果及 checker 返回 `JudgeVerdict`；实时界面用 `Phase` 和 `CaseState` 保存状态，不再制造带任意 `verdict` 字符串的占位 JSON。持久化事件在反序列化时同样验证阶段及其字段。`kind`、`result.phase`、verdict 的既有 JSON 值保持兼容，最终业务结果仍在协议边界使用 JSON。旧快照的 verdict 类型保留原序列化格式。

# VS Code → Rust 迁移审计

这份清单区分“内核已有能力”“插件实际调用了内核”和“界面应该留在宿主”。已使用 RPC 不代表所有业务逻辑都迁移完成。此次完成 CLI 命名、错误分类、配置入口、动态补全和取消导入修复；下表标为待迁移的功能目前仍在 TypeScript。

## 尚未迁移的业务

| 功能 | 当前路径（vscode-ext/src） | 状态及应有归属 |
| --- | --- | --- |
| ZIP 样例导入 | `domain/services/TestcaseScanner.ts::fromZip`、`infrastructure/services/archiveAdapter.ts` | 仍用 AdmZip 解压到插件配置的目录，可按设置删除原 ZIP。Rust 当前没有 ZIP/目录样例导入命令或 RPC。读取压缩包、限制解压大小、配对和导入事务应迁入 Rust；文件选择与结果确认留在宿主。 |
| 文件夹/单文件/拖放导入 | `TestcaseScanner.ts::fromFolder/fromFile`、`domain/services/TestcaseMatcher.ts`、`application/useCases/webview/DragDrop.ts` | 目录遍历、按扩展名配对、同名匹配、自然排序仍在 TS；多选 UI 可保留，扫描规则与导入语义应由 Rust 拥有。 |
| 样例批量替换/保存 | `infrastructure/problems/problemService.ts::applyTestcases`、`infrastructure/rpc/problemService.ts::loadTestcases/persist` | 先修改客户端模型，再逐条 RPC 增删改、重排，整个批量操作不是一个 Rust 事务。取消/空选择清空旧样例的错误本次已修复；中途 RPC 失败后的整批回滚仍待统一。 |
| 旧数据自动发现与版本升级 | `infrastructure/problems/cphMigrationService.ts`、`problemMigrationService.ts`、`problemService.ts::loadBySrc` | Rust 已能导入 `.prob/.bin`，但插件仍有自动查找、gunzip、历史版本升级和路径修复的独立流程。需要把发现结果交给内核导入，逐项确认旧版本语义覆盖后移除旧转换。 |
| 题目复制 | `infrastructure/problems/problemCopyService.ts` | 仍由 TS 复制源码、样例、辅助程序及旧路径，并处理回滚和清理。应由 Rust 提供完整复制事务；“复制为独立题目”与已有 `problem.link` 的“共用测试标准”是两个用户动作。 |
| 源码移动文件操作 | `application/useCases/webview/problem/manage/MoveProblem.ts`、`infrastructure/rpc/problemService.ts::move` | Rust 已负责重新绑定 code_id，但插件仍自己复制和删除源文件；CLI 也在 interface 层组织实际文件移动。文件移动和身份更新应收敛到同一个 application 操作，宿主负责保存/重开文档。 |
| 模板与导入源码创建 | `infrastructure/services/templateRenderer.ts`、`pathResolverAdapter.ts`、`application/useCases/companion/ImportCompanionProblems.ts` | Companion 题目导入已经调用 Rust `problem.import`；源码模板展开和源文件创建仍在 TS。工作区选择、文档状态、用户脚本上下文属于宿主；纯模板展开与原子文件创建可迁入 Rust。 |
| 测试数据文件/内联转换 | `infrastructure/problems/testcaseIoService.ts` | 客户端仍读写测试文件、产生编辑器临时文件和决定是否内联。编辑器临时文件可留宿主，持久测试数据和大小限制应统一到 Rust。 |
| 多窗口题目保存合并 | `infrastructure/rpc/problemChanges.ts`、`problemService.ts::persist` | 当前客户端用基线/草稿/远端三方合并避免误覆盖。单个字段并发写入仍有预检至提交的时间窗口；可参考已有 config 的比较后替换机制，增加内核版本号与整批条件写入。 |

具体入口：[扫描器](../../vscode-ext/src/domain/services/TestcaseScanner.ts)、[配对器](../../vscode-ext/src/domain/services/TestcaseMatcher.ts)、[RPC 题目服务](../../vscode-ext/src/infrastructure/rpc/problemService.ts)、[旧题目服务](../../vscode-ext/src/infrastructure/problems/problemService.ts)、[复制服务](../../vscode-ext/src/infrastructure/problems/problemCopyService.ts)。

## 已迁移与保留的宿主功能

Rust 已拥有工具链自动发现/探测、编译/执行、比较器、SPJ/交互评测、对拍、取消与进程树监督、队列、持久历史、题目/样例存储、配置继承和校验、索引与共享源码身份、四种格式的题目导入导出，以及 Companion HTTP/WebSocket 网关。VS Code 的语言策略只是语言元数据和 RPC 适配，不能以文件仍叫 `cppStrategy.ts` 判断它还在编译代码。

VS Code 应继续保留命令注册、文件/文件夹选择、QuickPick、编辑器保存和打开、Webview 消息桥、状态栏、虚拟文档、剪贴板、设置表单、展开/隐藏等 UI 状态。浏览器的站点 DOM、标签页和提交页面操作仍由浏览器插件实现。已删除的 TypeScript 编译/执行器和 Node vscode-router 不需要恢复。

仍在 VS Code 设置中的 `inputFileExtensionList`、`outputFileExtensionList`、`clearBeforeLoad`、`unzipFolder`、`deleteAfterUnzip`、`foundMatchTestcaseBehavior` 混有业务规则与界面偏好。前五项涉及导入行为，应随 Rust 导入服务迁移；匹配后是否弹出询问属于 UI 偏好，匹配结果由内核提供。模板内容/纯渲染规则与工作区脚本的编辑器上下文应分别处理。

## 错误与覆盖规则审计

CLI/application 已统一不存在、冲突、参数、占用和执行失败分类；参数解析错误也按 JSON/JSONL 输出，`serve` 运行期诊断走 stderr，避免污染 RPC stdout。`tc update` 要求显式 ID，重复 ID 选择不再被静默折叠。`--force` 仅确认有损 export，任何格式仍禁止覆盖已存在目标。详情见 [CLI 契约](cli.md#错误与强制参数)。

旧插件还有以下差异，需要和上述待迁移操作一起收敛：

- `ArchiveAdapter.unzip` 调用 `extractAllTo(destPath, true)`，允许覆盖解压目录里的文件；其规则尚不等同于 Rust 的“新目标、不得覆盖”。建议 Rust 直接读取 ZIP 条目并导入测试内容，减少对工作区的解压写入；至少需要预览、压缩大小限制、路径校验与原子提交。
- `clearBeforeLoad` 是持续保存的偏好，不能代表用户本次确认任意数据损失；取消或没有可导入数据现在保留原样例。未来整批替换应预览明确的删除范围，CLI 用显式 replace/force，Webview 显示同一损失信息后提交相同授权。
- `ProblemCopyService.removeOrphanedCopiedFiles` 根据目标源码不存在推测辅助文件是残留并清理，不能证明这些文件属于上一次复制。Rust 复制事务应记录自己创建的文件，只回滚自己的写入，并拒绝现有目标。
- 旧题目读取对文件访问错误统一返回 null；旧 `.prob` 迁移捕获解析错误后返回 undefined。这会把部分读取失败表现为“没有题目”，不同于 Rust 的显式错误。迁移入口应分别处理未找到、无权限和数据损坏，并显示可操作的错误。

这些是已确认的存量差异，不能据“所有保存最终经过 RPC”推断它们已经受到 Rust 的事务和强制参数检查。下一轮优先顺序应是 ZIP/目录扫描与整批样例导入、复制/移动事务、旧格式迁移入口，再收敛模板与路径策略；每项以 CLI/RPC/插件调用同一实现为完成标准。

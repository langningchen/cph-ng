# cph-ng 架构重构与状态说明

> **File:** `.github/copilot-instructions.agent.md`
> **Last Updated:** 2025-12-18
> **Status:** Phase 1 (RunSingleTc) Completed

本文档旨在记录 `cph-ng` 后端架构重构的完整上下文、技术决策、当前代码状态及后续开发指南。请在后续开发中严格遵循此文档的规范。

## 1. 架构目标 (Architecture Goals)

我们将项目从强耦合的单一架构迁移至 **Hexagonal Architecture (Ports & Adapters)**，目标是：
*   **解耦 (Decoupling):** 将核心业务逻辑（Domain/Use Cases）与 VS Code API、Node.js 运行时细节彻底分离。
*   **可测试性 (Testability):** 允许在不启动 VS Code 的情况下，通过 Mock 适配器对核心逻辑进行极速单元测试。
*   **清晰职责 (Clean Responsibility):** 明确每一层代码只能做什么，不能做什么。

### 分层定义
1.  **Domain (`src/domain`):** 纯业务实体与规则（如 `VerdictRules`）。**严禁**引用 VS Code 或 Node.js API。
2.  **Application (`src/application`):** 用例编排层。仅依赖 **Ports**（接口）。**严禁**引用具体实现。
3.  **Ports (`src/application/ports`):** 定义外部能力的接口（如 `ICompiler`, `IProcessExecutor`）。
4.  **Infrastructure (`src/infrastructure`):** 端口的具体实现（Adapters）。这里可以引用 VS Code / Node.js API。
5.  **Composition (`src/composition`):** 依赖注入（DI）的装配根。

---

## 2. 技术栈与工具 (Tech Stack)

*   **Dependency Injection:** `tsyringe`
*   **Metadata:** `reflect-metadata`
*   **Build:** Webpack (配合 `ts-loader` 处理装饰器)
*   **Linting:** `Biome` (pnpm run format / lint)
*   **Type Check:** `tsc --noEmit`

---

## 3. 当前目录结构与映射 (Directory Structure)

```text
src/
├── application/           # [Layer: Application]
│   ├── ports/             # 接口定义 (ICompiler, IProcessExecutor, IProblemRepository...)
│   └── useCases/          # 业务用例 (RunSingleTc.ts...)
├── composition/           # [Layer: Composition Root]
│   ├── container.ts       # DI 容器装配、注册单例
│   └── tokens.ts          # DI Token 常量定义
├── infrastructure/        # [Layer: Infrastructure]
│   ├── compiler/          # CompilerAdapter (实现 ICompiler)
│   ├── node/              # Node 相关的适配器 (FS, ChildProcess)
│   ├── problems/          # ProblemRepository (实现 IProblemRepository)
│   ├── runner/            # RunnerAdapter (实现 IRunner)
│   └── vscode/            # VS Code 相关的适配器 (Settings, Telemetry)
├── modules/               # [Legacy] 旧模块
│   ├── problemsManager.ts # 主要入口，正逐步重构为调用 Use Cases
│   └── extensionManager.ts# 扩展激活入口，负责初始化 Container
└── ...
```

---

## 4. 已完成工作 (Completed Work - Phase 1)

我们已成功完成 **Phase 1: Run Single Test Case** 的全链路 DI 迁移。

### 4.1 基础设施搭建
*   [x] 配置 `tsconfig.json` (`experimentalDecorators`, `emitDecoratorMetadata`).
*   [x] 配置 `package.json` & `webpack.config.mjs` (引入 `tsyringe`, `reflect-metadata`).
*   [x] 创建 `src/composition/container.ts` 与 `tokens.ts`。
*   [x] 在 `extension.ts` 顶部引入 `reflect-metadata`。
*   [x] 在 `ExtensionManager.activate` 中调用 `setupContainer()`。

### 4.2 核心链路迁移 (RunSingleTc)
*   [x] **Use Case:** 创建 `RunSingleTc`，实现了编译 -> 运行 -> 判定 -> 持久化的编排逻辑。
*   [x] **Ports Defined:** `ICompiler`, `IRunner`, `IProblemRepository`, `ISettings`, `ITelemetry` (及其他基础接口).
*   [x] **Adapters Implemented:**
    *   `CompilerAdapter`: 封装 `core/compiler.ts`。
    *   `RunnerAdapter`: 封装 `core/runner.ts`。
    *   `ProblemRepository`: 封装 `.cph-ng` JSON 读写与状态更新。
    *   `SettingsAdapter`: 封装 `helpers/settings.ts`。
    *   `TelemetryAdapter`: 封装全局 `telemetry` 对象。
*   [x] **Wiring:** 在 `container.ts` 中注册了上述适配器。
*   [x] **Integration:** 修改 `ProblemsManager.runTc`，使其从容器解析 `RunSingleTc` 并调用 `exec` 方法。
    *   *注意：旧的逻辑代码尚未删除，但在此路径下已被旁路。*

### 4.3 质量保证
*   [x] **Lint/Format:** 所有文件通过 `pnpm run lint` 和 `pnpm run format`。
*   [x] **Type Check:** 通过 `pnpm exec tsc --noEmit` 检查无类型错误。
*   [x] **Cleanup:** 移除了未被 `RunSingleTc` 使用的多余端口和注册，保持最小集。

---

## 5. 开发规范与注意事项 (Development Guidelines)

在进行后续开发时，请严格遵守以下规则：

1.  **依赖方向原则:**
    *   `src/application` **绝不能** 导入 `src/infrastructure` 或 `src/modules` (除了类型定义)。
    *   `src/domain` **绝不能** 导入 `src/application` 或任何外部库。
2.  **DI 注册:**
    *   所有新的 Adapter 必须在 `src/composition/container.ts` 中注册。
    *   使用 `tokens.ts` 中的字符串 Token，避免 Symbol 导致的跨包问题。
3.  **旧代码处理:**
    *   **不要删除** 旧的 `core/` 或 `modules/` 代码，除非我们已经完成了所有功能的迁移。目前处于共存阶段。
4.  **构建检查流程:**
    *   每次修改后，必须按顺序运行以下命令：
        1.  `pnpm run format`
        2.  `pnpm run lint`
        3.  `pnpm exec tsc --noEmit` (非常重要，用于检查类型完整性)
        4.  `pnpm run package` (确保 webpack 打包无误)

---

## 6. 后续计划 (Next Steps)

### Phase 2: Run All Test Cases & Compilation
*   [ ] 创建 `RunAllTcs` Use Case。
*   [ ] 创建 `CompileOnly` Use Case。
*   [ ] 将这些 Use Case 注册到 Container，并在 `ProblemsManager` 中替换旧调用。

### Phase 3: Advanced Features
*   [ ] 迁移 `Import` (从 Competitive Companion 导入)。
*   [ ] 迁移 `Submit` (提交代码)。
*   [ ] 完善 `Domain` 层，将分散在 adapter 中的业务规则（如 Verdict 判定细节）内聚到 `domain/services`。

### Phase 4: Testing & Cleanup
*   [ ] 为 `RunSingleTc` 和 `Domain` 编写基于内存适配器的单元测试 (Jest/Vitest)。
*   [ ] 逐步删除不再被引用的旧代码。

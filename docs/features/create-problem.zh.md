# 创建问题

在工作区中创建一个新的竞争性编程问题。

## 概述

创建问题功能为当前活动的源文件初始化一个新问题。它创建问题元数据结构并根据您的设置设置默认配置。

## UI 交互

### 触发功能

**方法 1：侧边栏按钮**
- 打开一个源文件（`.cpp`、`.c` 或 `.java`）
- 点击 CPH-NG 侧边栏面板中的 `CREATE` 按钮

**方法 2：命令面板**
- 按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（macOS）
- 输入并选择：`CPH-NG: Create Problem`

**方法 3：键盘快捷键**
- 按 `Ctrl+Alt+B`（Windows/Linux）或 `Cmd+Alt+B`（macOS）

### 前置条件

- 必须有一个打开源文件的编辑器处于活动状态
- 文件必须具有支持的扩展名（`.cpp`、`.c`、`.java`）
- 此文件不应已存在问题

### UI 组件

**位置**：`src/webview/components/createProblemView.tsx`

创建问题视图显示：
- 解释操作的警告提示
- `CREATE` 按钮（Material-UI Button 带 SendIcon）
- 如果检测到 CPH 数据，显示可选的 `IMPORT` 按钮

## 内部操作

### 代码流程

**入口点**：`src/modules/cphNg.ts` - `createProblem(filePath?: string)`

1. **验证**（`src/modules/cphNg.ts:28-44`）
   ```typescript
   - 检查 filePath 是否存在
   - 验证此文件不存在问题
   - 如果验证失败则显示警告
   ```

2. **问题创建**（`src/helpers/problems.ts:54-64`）
   ```typescript
   const problem = Problems.createProblem(filePath);
   ```
   创建包含以下内容的问题对象：
   - `version`：当前 CPH-NG 版本
   - `name`：不带扩展名的文件名
   - `src.path`：源文件的完整路径
   - `tcs`：空数组（最初没有测试用例）
   - `timeLimit`：来自 `cph-ng.problem.defaultTimeLimit`
   - `memoryLimit`：来自 `cph-ng.problem.defaultMemoryLimit`
   - `timeElapsed`：0（跟踪在问题上花费的时间）

3. **存储**（`src/helpers/problems.ts` - `saveProblem`）
   - 使用模板模式计算二进制文件路径
   - 将问题数据序列化为 JSON
   - 使用 gzip 压缩
   - 写入工作区的 `.cph-ng/` 文件夹

4. **UI 刷新**（`src/modules/problemsManager.ts` - `dataRefresh`）
   - 将新问题加载到活动问题列表中
   - 使用问题信息更新侧边栏
   - 发出事件以刷新 webview

### 文件系统

**问题存储位置**：
- 默认：`${workspace}/.cph-ng/${relativeDirname}/${basename}.bin`
- 可通过 `cph-ng.problem.problemFilePath` 配置

**文件格式**：
- Gzip 压缩的 JSON
- 包含问题元数据和测试用例
- 二进制扩展名（.bin）以防止意外编辑

### 消息流

**WebView → 扩展**：
```typescript
// src/webview/components/createProblemView.tsx:69-72
msg({ type: 'createProblem' })
```

**扩展处理程序**：
```typescript
// src/modules/sidebarProvider.ts:102-103
if (msg.type === 'createProblem') {
    await CphNg.createProblem(msg.activePath);
}
```

## 配置选项

### 相关设置

#### `cph-ng.problem.defaultTimeLimit`
- **类型**：`number`
- **默认值**：`1000`（毫秒）
- **描述**：新创建问题的默认时间限制
- **应用时机**：问题创建时

#### `cph-ng.problem.defaultMemoryLimit`
- **类型**：`number`
- **默认值**：`512`（MB）
- **描述**：新创建问题的默认内存限制
- **应用时机**：问题创建时

#### `cph-ng.problem.problemFilePath`
- **类型**：`string`
- **默认值**：`"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`
- **描述**：问题文件存储位置的模板模式
- **变量**：
  - `${workspace}`：工作区根目录
  - `${dirname}`：源文件目录
  - `${relativeDirname}`：相对于工作区的目录
  - `${basename}`：带扩展名的文件名
  - `${basenameNoExt}`：不带扩展名的文件名
  - `${extname}`：文件扩展名
- **应用时机**：问题文件路径计算时

#### `cph-ng.problem.templateFile`
- **类型**：`string`
- **默认值**：`""`（空）
- **描述**：创建新问题时使用的模板文件路径
- **应用时机**：初始源文件创建时（如果文件不存在）

### 配置示例

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.problem.defaultMemoryLimit": 256,
  "cph-ng.problem.problemFilePath": "${workspace}/.cph/${basenameNoExt}.bin"
}
```

## 错误处理

### 常见错误

**没有活动编辑器**
- **原因**：当前没有打开文件
- **消息**："No active editor found. Please open a file to create a problem."
- **解决方案**：打开源文件后重试

**问题已存在**
- **原因**：此源文件的问题文件已存在
- **消息**："Problem already exists for this file"
- **解决方案**：先删除现有问题或使用其他文件

**未找到工作区**
- **原因**：文件不在工作区文件夹中
- **消息**：问题创建静默失败
- **解决方案**：在工作区文件夹中打开文件

### 实现

错误处理代码：`src/modules/cphNg.ts:28-44`

## 工作流示例

### 典型用法

1. 打开一个新的 C++ 文件：`problem.cpp`
2. 点击侧边栏中的 `CREATE` 按钮
3. CPH-NG 创建：
   - 具有默认限制的问题元数据
   - 空测试用例数组
   - 位于 `.cph-ng/problem.cpp.bin` 的二进制文件
4. 侧边栏更新以显示问题面板
5. 准备添加测试用例

### 使用自定义设置

```json
{
  "cph-ng.problem.defaultTimeLimit": 3000,
  "cph-ng.problem.defaultMemoryLimit": 1024
}
```

结果：创建的新问题具有 3000ms 时间限制和 1024MB 内存限制。

## 相关功能

- [添加测试用例](add-test-case.md) - 创建后添加测试用例
- [编辑问题](edit-problem.md) - 修改问题元数据
- [导入问题](import-problem.md) - 从 CPH 的替代创建方法
- [删除问题](delete-problem.md) - 删除创建的问题

## 技术细节

### 依赖关系

- `src/helpers/problems.ts` - 问题数据管理
- `src/modules/cphNg.ts` - 命令实现
- `src/modules/problemsManager.ts` - 问题生命周期管理
- `src/webview/components/createProblemView.tsx` - UI 组件

### 数据结构

```typescript
interface Problem {
    version: string;           // CPH-NG 版本
    name: string;              // 问题名称（文件名）
    src: { path: string };     // 源文件路径
    tcs: TC[];                 // 测试用例数组
    timeLimit: number;         // 时间限制（毫秒）
    memoryLimit: number;       // 内存限制（MB）
    timeElapsed: number;       // 花费时间（毫秒）
    url?: string;              // 可选问题 URL
    checker?: SrcFile;         // 可选 SPJ 检查器
    interactor?: SrcFile;      // 可选交互器
    bfCompare?: BFCompare;     // 可选暴力对拍配置
}
```

### 源代码参考

- 命令注册：`src/modules/extensionManager.ts:200-206`
- WebView 处理程序：`src/modules/sidebarProvider.ts:102-103`
- 问题创建：`src/modules/cphNg.ts:28-44`
- 数据结构：`src/helpers/problems.ts:54-64`
- UI 组件：`src/webview/components/createProblemView.tsx:65-74`

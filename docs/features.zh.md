# 功能指南

本指南全面介绍 CPH-NG 的所有功能，按工作流程和交互模式组织。

## 目录

- [入门指南](#入门指南)
- [问题管理](#问题管理)
- [测试用例管理](#测试用例管理)
- [运行和测试](#运行和测试)
- [结果分析](#结果分析)
- [高级功能](#高级功能)
- [集成功能](#集成功能)

## 入门指南

### 打开 CPH-NG 面板

1. 安装后，您会在 VS Code 活动栏（左侧边栏）中找到 CPH-NG 图标
2. 点击图标打开 CPH-NG 侧边栏面板
3. 如果需要，您可以将面板拖动到其他位置

### 初始设置

在创建第一个问题之前，您可能需要配置：

- [编译设置](configuration.md#编译设置)中的编译器路径和标志
- [问题设置](configuration.md#问题设置)中的默认时间和内存限制
- 如果您使用代码模板，请配置模板文件位置

## 问题管理

### 创建新问题

![创建问题](images/createProblem.png)

**触发方式：**

- 当不存在问题时，点击侧边栏中的 `CREATE` 按钮
- 从命令面板（Ctrl/Cmd+Shift+P）使用命令 `CPH-NG: Create Problem`
- 使用键盘快捷键 `Ctrl+Alt+B`（Windows/Linux）或 `Cmd+Alt+B`（macOS）

**CPH-NG 的操作：**

1. 基于您的模板（如果已配置）或空白文件创建新的源文件
2. 在编辑器中打开文件
3. 在工作区中创建 `.cph-ng` 文件夹以存储问题数据
4. 使用默认时间和内存限制初始化空问题
5. 在侧边栏显示问题面板

**配置选项：**

- `cph-ng.problem.templateFile` - 代码模板文件的路径
- `cph-ng.problem.defaultTimeLimit` - 默认时间限制（毫秒，默认值：1000）
- `cph-ng.problem.defaultMemoryLimit` - 默认内存限制（MB，默认值：512）
- `cph-ng.problem.problemFilePath` - 存储问题数据的路径模式

### 从 Competitive Companion 导入

![Companion 导入](images/loadFromFile.png)

**触发方式：**

- 安装 [Competitive Companion](https://github.com/jmerle/competitive-companion) 浏览器扩展
- 导航到支持的在线评测平台上的问题
- 点击浏览器中的 Competitive Companion 图标
- CPH-NG 将自动接收问题数据

**CPH-NG 的操作：**

1. 在本地端口（默认：27121）监听问题数据
2. 自动创建使用问题名称的新文件
3. 从问题导入所有样例测试用例
4. 根据问题约束设置时间和内存限制
5. 在编辑器中打开新文件

**配置选项：**

- `cph-ng.companion.listenPort` - 监听 Competitive Companion 的端口（默认：27121）
- `cph-ng.companion.defaultExtension` - 创建文件的文件扩展名（默认："cpp"）
- `cph-ng.companion.addTimestamp` - 在文件名中添加时间戳以避免冲突（默认：true）
- `cph-ng.companion.chooseSaveFolder` - 提示选择保存位置（默认：false）
- `cph-ng.companion.showPanel` - 控制导入后何时显示问题面板
- `cph-ng.companion.shortCodeforcesName` - 对 Codeforces 问题使用较短的文件名（默认：true）
- `cph-ng.companion.shortLuoguName` - 对洛谷问题使用较短的文件名（默认：true）
- `cph-ng.companion.shortAtCoderName` - 对 AtCoder 问题使用较短的文件名（默认：true）

### 编辑问题元数据

![编辑问题](images/editProblem.png)

**触发方式：**

- 点击问题面板右上角的**笔形图标**

**CPH-NG 的操作：**

- 打开一个对话框，您可以编辑：
  - 问题标题
  - 问题 URL（原始问题的链接）
  - 时间限制（毫秒）
  - 内存限制（MB）
  - 特殊评测（checker）程序路径
  - 交互库（interactor）程序路径

**配置选项：**

没有直接相关的选项，但请参阅[特殊评测](#特殊评测)了解检查器配置。

### 删除问题

![删除问题](images/deleteProblem.png)

**触发方式：**

- 点击问题控制面板中的**垃圾桶图标**（最右边的按钮）

**CPH-NG 的操作：**

1. 显示确认对话框
2. 如果确认，从 `.cph-ng` 文件夹删除问题数据
3. 关闭问题面板
4. 返回到"创建问题"视图

**注意：** 这不会删除您的源代码文件，只删除问题元数据和测试用例。

### 耗时跟踪

![耗时](images/timeElasped.png)

**显示内容：**

CPH-NG 自动跟踪您在问题上工作的时间，从创建问题时开始计算。此信息显示在问题面板标题中。

**配置选项：**

无 - 此功能始终处于活动状态。

## 测试用例管理

### 手动添加单个测试用例

![添加测试用例](images/addTestCase.png)

**触发方式：**

- 点击问题标题下方控制面板中的**加号图标**（最左边的按钮）

**CPH-NG 的操作：**

1. 创建新的空测试用例
2. 展开测试用例视图
3. 允许您输入：
   - 输入数据（stdin）
   - 预期答案（stdout）

**配置选项：**

- `cph-ng.problem.maxInlineDataLength` - 内联数据显示的最大大小（默认：65536 字节）

### 从文件/文件夹加载测试用例

![从文件加载](images/loadFromFile.png)
![从压缩包加载](images/loadFromZip.png)
![从文件夹加载](images/loadFromFolder.png)
![加载文件确认](images/loadFromFileConfirm.png)

**触发方式：**

- 点击控制面板中的**文件夹图标**（左数第二个按钮）

**CPH-NG 的操作：**

1. 提示您选择来源：
   - 从 zip 文件加载
   - 从文件夹加载
2. 对于 zip 文件：
   - 要求您选择 zip 文件
   - 将其解压到临时文件夹
   - 可选择在解压后删除 zip 文件
3. 对于文件夹：
   - 要求您选择文件夹
4. 扫描匹配的输入/输出文件：
   - 扩展名为 `.in` 的文件被视为输入文件
   - 扩展名为 `.out` 或 `.ans` 的文件被视为答案文件
   - 按基本名称匹配文件（例如，`test1.in` 与 `test1.out` 匹配）
5. 显示找到的测试用例列表供您选择
6. 导入所选的测试用例

**配置选项：**

- `cph-ng.problem.unzipFolder` - 解压 zip 文件的文件夹模式（默认：`${workspace}/.cph-ng/${zipBasenameNoExt}`）
- `cph-ng.problem.deleteAfterUnzip` - 解压后删除 zip 文件（默认：false）
- `cph-ng.problem.clearBeforeLoad` - 加载新测试用例前清除现有测试用例（默认：true）
- `cph-ng.basic.folderOpener` - 文件夹选择方法："tree" 或 "flat"（默认："tree"）

### 从嵌入数据加载

![从嵌入加载](images/loadFromEmbedded.png)

**触发方式：**

- 从命令面板使用命令 `CPH-NG: Load from Embedded`

**CPH-NG 的操作：**

1. 扫描当前源文件中的嵌入测试用例数据
2. 解析嵌入数据格式
3. 将测试用例加载到问题中

**注意：** 当测试用例嵌入在源文件注释中时，此功能很有用。

### 从 CPH 导入

![从 CPH 导入](images/importFromCph.png)
![从 CPH 导入完成](images/importedFromCph.png)

**触发方式：**

- 当在工作区检测到 CPH 数据时，点击 `IMPORT` 按钮
- 或使用命令 `CPH-NG: Import from CPH`

**CPH-NG 的操作：**

1. 在工作区中搜索 `.cph` 文件夹（原始 CPH 格式）
2. 将 CPH 问题格式转换为 CPH-NG 格式
3. 导入所有测试用例和问题元数据
4. 创建相应的 `.cph-ng` 问题数据

**配置选项：**

- `cph-ng.cphCapable.enabled` - 启用 CPH 兼容功能（默认：true）

### 在文件和内联显示之间切换

![切换到文件](images/toggleToFile.png)
![切换到内联大文件](images/toogleToInlineLarge.png)

**触发方式：**

- 点击测试用例中输入、输出或答案字段旁边的**文件切换图标**

**CPH-NG 的操作：**

- **切换到文件：**
  1. 将数据保存到 `.cph-ng` 文件夹中的外部文件
  2. 显示文件名而不是内联内容
  3. 您可以点击文件名查看文件
  
- **切换到内联：**
  1. 读取文件内容
  2. 如果文件太大（超过 `maxInlineDataLength`），显示警告
  3. 如果确认或文件足够小，则内联显示内容

**配置选项：**

- `cph-ng.problem.maxInlineDataLength` - 将大文件切换到内联时的警告阈值（默认：65536 字节）

### 编辑测试用例数据

**触发方式：**

- 直接点击测试用例的输入或答案字段

**CPH-NG 的操作：**

1. 使字段可编辑
2. 允许您修改内容
3. 自动保存更改

### 将输出设置为答案

![设置答案前](images/beforeSetAsAnswer.png)
![设置答案后](images/afterSetAsAnswer.png)

**触发方式：**

- 当测试用例有输出时，点击答案字段

**CPH-NG 的操作：**

1. 将当前输出复制到答案字段
2. 根据新答案更新测试用例结果

**使用场景：** 当您验证程序输出正确时，可以快速将其设置为预期答案。

### 删除测试用例

**触发方式：**

- 点击测试用例旁边的**垃圾桶图标**

**CPH-NG 的操作：**

1. 从问题中移除测试用例
2. 如果测试用例使用外部文件，则删除相关文件

## 运行和测试

### 运行单个测试用例

**触发方式：**

- 点击特定测试用例旁边的**绿色播放按钮**

**CPH-NG 的操作：**

1. 如果已修改，保存当前源文件
2. 如果需要，编译程序（或如果未更改则使用缓存的二进制文件）
3. 使用测试用例输入运行程序
4. 捕获 stdout、stderr、执行时间和内存使用情况
5. 将输出与预期答案进行比较
6. 显示结果状态（AC、WA、TLE 等）

**配置选项：**

参见[编译设置](configuration.md#编译设置)和[运行器设置](configuration.md#运行器设置)

### 运行所有测试用例

![测试用例运行](images/testCaseRun.png)
![文件测试用例](images/fileTestCase.png)

**触发方式：**

- 点击控制面板中央的**播放按钮**

**CPH-NG 的操作：**

1. 保存当前源文件
2. 如果需要，编译程序
3. 依次运行所有测试用例
4. 更新每个测试用例的结果
5. 自动滚动到第一个非 AC 测试用例并展开
6. 显示结果摘要（例如，"3/5 AC"）

**注意：** 您可以随时点击执行期间出现的停止按钮来停止执行。

### 停止测试执行

**触发方式：**

- 点击执行期间出现的**停止按钮**

**CPH-NG 的操作：**

1. 终止当前运行的测试用例
2. 取消剩余测试用例的执行
3. 对取消的测试显示"SK"（跳过）状态

**选项：**

- 提示时，您可以选择：
  - 仅停止当前测试用例
  - 停止所有剩余测试用例

## 结果分析

### 理解评测结果

CPH-NG 通过 21 种不同的状态提供详细反馈：

| 状态 | 全称 | 含义 |
|--------|-----------|---------|
| **UKE** | Unknown Error | 发生意外错误 |
| **AC** | Accepted | 答案正确 |
| **PC** | Partially Correct | 部分输出正确 |
| **PE** | Presentation Error | 输出格式不正确 |
| **WA** | Wrong Answer | 输出不正确 |
| **TLE** | Time Limit Exceeded | 超过时间限制 |
| **MLE** | Memory Limit Exceeded | 超过内存限制 |
| **OLE** | Output Limit Exceeded | 生成输出过多 |
| **RE** | Runtime Error | 程序崩溃 |
| **RF** | Restricted Function | 使用了禁止的操作 |
| **CE** | Compilation Error | 编译失败 |
| **SE** | System Error | 评测系统错误 |
| **WT** | Waiting | 等待运行 |
| **FC** | File Created | 测试用例文件就绪 |
| **CP** | Compiling | 正在编译 |
| **CPD** | Compiled | 编译完成 |
| **JG** | Judging | 正在运行 |
| **JGD** | Judged | 执行完成 |
| **CMP** | Comparing | 正在比较输出 |
| **SK** | Skipped | 执行已跳过 |
| **RJ** | Rejected | 无效的提交 |

**配置选项：**

- `cph-ng.sidebar.hiddenStatuses` - 在 UI 中隐藏的状态代码数组

### 比较输出与答案

![与答案比较](images/compareWithAnswer.png)

**触发方式：**

- 点击 WA 测试用例输出区域中的**比较图标**（最左边的按钮）

**CPH-NG 的操作：**

1. 打开并排比较视图
2. 突出显示您的输出和预期答案之间的差异
3. 显示逐行差异

**配置选项：**

- `cph-ng.comparing.regardPEAsAC` - 将格式错误视为通过（默认：false）
- `cph-ng.comparing.ignoreError` - 比较时忽略 stderr（默认：true）
- `cph-ng.comparing.oleSize` - 触发 OLE 的 MB 数（默认：3）

### 查看执行详情

每个测试用例显示：

- **状态**：当前评测结果（AC、WA、TLE 等）
- **时间**：执行时间（毫秒）
- **内存**：内存使用情况（MB，如果启用了运行器）
- **输入**：测试用例输入（或如果存储在外部则显示文件名）
- **输出**：程序输出（或如果存储在外部则显示文件名）
- **答案**：预期答案（或如果存储在外部则显示文件名）
- **错误**：标准错误输出（如果有）

### 清除测试结果

**触发方式：**

- 点击测试用例或控制面板中的**清除图标**

**CPH-NG 的操作：**

1. 清除输出、错误、时间和内存数据
2. 将状态重置为初始状态
3. 保持输入和答案不变

## 高级功能

### 特殊评测

![特殊评测](images/specialJudge.png)

**设置方法：**

1. 点击**笔形图标**编辑问题元数据
2. 点击"Choose Checker"按钮
3. 选择您的检查器程序文件

**CPH-NG 的操作：**

1. 运行测试用例时，向检查器传递三个文件：
   - 输入文件
   - 您的输出文件
   - 预期答案文件
2. 读取检查器的退出代码：
   - 退出代码 0 = AC（通过）
   - 退出代码 1 = WA（答案错误）
   - 退出代码 2 = PE（格式错误）
3. 读取检查器的输出以获取额外反馈

**检查器要求：**

- 必须是编译的可执行文件（推荐 C/C++）
- 应遵循 testlib.h 格式或返回适当的退出代码
- 应接收输入、输出和答案文件名作为命令行参数

**配置选项：**

没有特定于 SPJ 的选项，但如果需要编译检查器，则应用编译设置。

### 交互式问题

**设置方法：**

1. 点击**笔形图标**编辑问题元数据
2. 点击"Choose Interactor"按钮
3. 选择您的交互器程序文件

**CPH-NG 的操作：**

1. 启动交互器进程
2. 将程序的 stdout 连接到交互器的 stdin
3. 将交互器的 stdout 连接到程序的 stdin
4. 监视交互直到完成
5. 读取交互器的判定

**交互器要求：**

- 必须是编译的可执行文件
- 应处理双向通信
- 应在结束时输出判定

### 暴力对拍

**设置方法：**

1. 创建生成随机测试输入的生成器程序
2. 创建正确但缓慢的暴力解法
3. 创建您的优化解法
4. 使用命令 `CPH-NG: Brute Force Compare`

**CPH-NG 的操作：**

1. 运行生成器创建随机测试用例
2. 运行暴力解法获取预期答案
3. 运行您的解法并与暴力答案比较
4. 重复直到找到不匹配或您停止它
5. 如果找到不匹配，将其保存为新测试用例

**配置选项：**

- `cph-ng.bfCompare.generatorTimeLimit` - 生成器的时间限制（秒，默认：10）
- `cph-ng.bfCompare.bruteForceTimeLimit` - 暴力解法的时间限制（秒，默认：60）

### 编译优化

**智能缓存：**

CPH-NG 计算源代码和编译器设置的哈希值。如果自上次编译以来没有任何变化，它会重用缓存的二进制文件，显著加快测试执行速度。

**工作原理：**

1. 编译前，CPH-NG 对以下内容进行哈希：
   - 源文件内容
   - 编译器路径和标志
   - 特定于语言的设置
2. 将哈希值与之前的编译进行比较
3. 如果匹配，跳过编译
4. 如果不同，编译并更新哈希值

**配置选项：**

- `cph-ng.compilation.timeout` - 最大编译时间（毫秒，默认：10000）

### 自定义编译钩子

**设置方法：**

1. 启用 `cph-ng.compilation.useWrapper` 或 `cph-ng.compilation.useHook`
2. 创建修改编译行为的包装器脚本

**CPH-NG 的操作：**

- **包装器模式**：包装整个编译命令
- **钩子模式**：在编译前/后调用您的钩子

**使用场景：**

- 添加自定义预处理
- 复制额外文件
- 生成资源
- 自定义清理器选项

**配置选项：**

- `cph-ng.compilation.useWrapper` - 启用包装器模式（默认：false）
- `cph-ng.compilation.useHook` - 钩子脚本的路径（默认：false）

## 集成功能

### Codeforces 提交

**触发方式：**

- 使用命令 `CPH-NG: Submit to Codeforces`

**要求：**

1. 安装并配置 cf-tool
2. 问题必须通过 Competitive Companion 从 Codeforces 导入

**CPH-NG 的操作：**

1. 验证问题是否来自 Codeforces
2. 如果未配置，提示选择语言
3. 调用 cf-tool 提交您的解法
4. 显示提交结果

**配置选项：**

- `cph-ng.companion.submitLanguage` - 提交的默认语言 ID（默认：-1，每次提示）

### Git 集成

CPH-NG 尊重您的 `.gitignore` 并自动：

- 在工作区中创建 `.cph-ng` 文件夹
- 将编译的二进制文件存储在缓存目录中
- 将问题元数据与源代码分开

**推荐的 `.gitignore` 条目：**

```
.cph-ng/
*.bin
*.exe
```

### 语言模型工具（Copilot）

CPH-NG 通过两个工具提供 AI 助手集成：

**1. 运行测试用例工具**

允许 AI 助手：
- 运行特定测试用例
- 运行所有测试用例
- 获取执行结果

**2. 读取问题文件工具**

允许 AI 助手：
- 读取测试输入文件
- 读取测试输出文件
- 读取预期答案文件
- 读取错误输出文件

这些工具使 AI 助手能够通过分析测试结果帮助调试您的代码。

## 键盘快捷键

| 操作 | Windows/Linux | macOS |
|--------|---------------|-------|
| 创建问题 | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| 运行测试用例 | 可自定义绑定 | 可自定义绑定 |

**自定义快捷键：**

1. 打开命令面板（Ctrl/Cmd+Shift+P）
2. 搜索"首选项：打开键盘快捷键"
3. 搜索"CPH-NG"命令
4. 设置您首选的键绑定

## 技巧和最佳实践

### 工作流程技巧

1. **使用模板**：设置一个包含常用头文件和代码结构的模板文件
2. **按比赛组织**：为每个比赛创建文件夹以保持问题井然有序
3. **增量测试**：在开发时运行测试用例，不要等到最后
4. **将大用例保存为文件**：对于具有大输入/输出的测试用例，使用文件切换
5. **使用暴力对拍**：调试时，使用暴力比较找到边界情况

### 性能技巧

1. **启用缓存**：默认设置已启用编译缓存
2. **使用文件存储**：对于非常大的测试用例，将其存储为文件而不是内联
3. **定期清理缓存**：启用 `cph-ng.cache.cleanOnStartup` 以避免缓存堆积

### 故障排除技巧

1. **编译问题**：检查设置中的编译器路径
2. **超时问题**：在运行器设置中增加时间限制
3. **内存问题**：增加内存限制或启用运行器以进行准确测量
4. **路径问题**：在配置中使用绝对路径或工作区相对路径

## 下一步

- 了解所有[配置选项](configuration.md)
- 查看[常见问题](faq.md)了解常见问题
- 访问 [GitHub 仓库](https://github.com/langningchen/cph-ng)获取支持

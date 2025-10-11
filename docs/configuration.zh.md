# 配置参考

本页面提供 CPH-NG 所有配置选项的完整参考。所有设置都可以通过 VS Code 的设置 UI 配置，或通过编辑 `settings.json` 文件配置。

## 快速导航

- [基本设置](#基本设置)
- [编译设置](#编译设置)
- [运行器设置](#运行器设置)
- [比较设置](#比较设置)
- [暴力对拍设置](#暴力对拍设置)
- [问题设置](#问题设置)
- [缓存设置](#缓存设置)
- [CPH 兼容性设置](#cph-兼容性设置)
- [Competitive Companion 设置](#competitive-companion-设置)
- [侧边栏设置](#侧边栏设置)

---

## 基本设置

控制扩展基本行为的设置。

### `cph-ng.basic.folderOpener`

**类型：** `string`  
**默认值：** `"tree"`  
**选项：** `"tree"` | `"flat"`

控制从文件夹加载测试用例时文件夹选择对话框的显示方式。

- **`tree`**：使用 VS Code 的原生基于树的文件夹选择器（推荐）
- **`flat`**：使用基于平面列表的文件夹选择器

**示例：**

```json
{
  "cph-ng.basic.folderOpener": "tree"
}
```

**何时更改：**

- 如果在某些平台上树选择器有问题，使用 `"flat"`
- 使用 `"tree"` 更好地导航嵌套文件夹结构

---

## 编译设置

控制代码编译方式的设置。

### `cph-ng.compilation.cCompiler`

**类型：** `string`  
**默认值：** `"gcc"`

用于编译 C 源文件的 C 编译器可执行文件。

**示例：**

```json
{
  "cph-ng.compilation.cCompiler": "gcc"
}
```

**常见替代方案：**

- `"clang"` - 使用 Clang 代替 GCC
- `"/usr/bin/gcc-11"` - 使用特定的 GCC 版本

### `cph-ng.compilation.cArgs`

**类型：** `string`  
**默认值：** `"-O2 -std=c11 -Wall -DCPH"`

编译 C 源文件时使用的编译器标志。

**默认标志说明：**

- `-O2`：二级优化
- `-std=c11`：使用 C11 标准
- `-Wall`：启用所有警告
- `-DCPH`：定义 CPH 宏（用于条件编译）

**示例：**

```json
{
  "cph-ng.compilation.cArgs": "-O2 -std=c17 -Wall -Wextra -DCPH -fsanitize=address"
}
```

### `cph-ng.compilation.cppCompiler`

**类型：** `string`  
**默认值：** `"g++"`

用于编译 C++ 源文件的 C++ 编译器可执行文件。

**示例：**

```json
{
  "cph-ng.compilation.cppCompiler": "g++"
}
```

**常见替代方案：**

- `"clang++"` - 使用 Clang 代替 GCC
- `"/usr/bin/g++-11"` - 使用特定的 GCC 版本

### `cph-ng.compilation.cppArgs`

**类型：** `string`  
**默认值：** `"-O2 -std=c++14 -Wall -DCPH"`

编译 C++ 源文件时使用的编译器标志。

**默认标志说明：**

- `-O2`：二级优化
- `-std=c++14`：使用 C++14 标准
- `-Wall`：启用所有警告
- `-DCPH`：定义 CPH 宏

**示例：**

```json
{
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall -Wextra -DCPH"
}
```

**常见自定义：**

- 将 `-std=c++14` 更改为 `-std=c++17` 或 `-std=c++20` 以使用更新的标准
- 添加 `-fsanitize=address` 用于调试内存问题
- 添加 `-fsanitize=undefined` 用于捕获未定义行为
- 添加 `-g` 用于调试符号
- 添加 `-static` 用于静态链接

### `cph-ng.compilation.javaCompiler`

**类型：** `string`  
**默认值：** `"javac"`

用于编译 Java 源文件的 Java 编译器可执行文件。

**示例：**

```json
{
  "cph-ng.compilation.javaCompiler": "javac"
}
```

### `cph-ng.compilation.javaArgs`

**类型：** `string`  
**默认值：** `"-cp ."`

编译 Java 源文件时使用的编译器标志。

**默认标志说明：**

- `-cp .`：将类路径设置为当前目录

**示例：**

```json
{
  "cph-ng.compilation.javaArgs": "-cp . -encoding UTF-8"
}
```

### `cph-ng.compilation.javaRunner`

**类型：** `string`  
**默认值：** `"java"`

用于运行 Java 程序的 Java 运行时可执行文件。

**示例：**

```json
{
  "cph-ng.compilation.javaRunner": "java"
}
```

### `cph-ng.compilation.javaRunArgs`

**类型：** `string`  
**默认值：** `""`

执行 Java 程序时传递给 Java 运行时的参数。

**示例：**

```json
{
  "cph-ng.compilation.javaRunArgs": "-Xmx512m"
}
```

### `cph-ng.compilation.objcopy`

**类型：** `string`  
**默认值：** `"objcopy"`

objcopy 实用程序路径，用于从编译的二进制文件中剥离调试符号。

**示例：**

```json
{
  "cph-ng.compilation.objcopy": "objcopy"
}
```

### `cph-ng.compilation.timeout`

**类型：** `number`  
**默认值：** `10000`  
**单位：** 毫秒

编译的最大允许时间。如果编译时间超过此值，将被终止。

**示例：**

```json
{
  "cph-ng.compilation.timeout": 15000
}
```

**何时更改：**

- 对于编译时间较长的大型项目增加
- 如果希望更快地获得编译错误反馈则减少

### `cph-ng.compilation.useWrapper`

**类型：** `boolean`  
**默认值：** `false`

启用编译的包装器模式。启用后，整个编译命令通过自定义包装器脚本传递。

**示例：**

```json
{
  "cph-ng.compilation.useWrapper": true
}
```

**使用场景：**

- 自定义源文件预处理
- 添加额外的编译步骤
- 与构建系统集成

### `cph-ng.compilation.useHook`

**类型：** `string`  
**默认值：** `false`

在编译前/后运行的钩子脚本的路径。

**示例：**

```json
{
  "cph-ng.compilation.useHook": "/path/to/hook.sh"
}
```

**使用场景：**

- 复制资源文件
- 运行代码生成器
- 自定义验证

---

## 运行器设置

控制程序执行方式的设置。

### `cph-ng.runner.timeAddition`

**类型：** `number`  
**默认值：** `1000`  
**单位：** 毫秒

执行时添加到问题时间限制的额外时间。这考虑了系统开销，确保合法解法不会受到惩罚。

**示例：**

```json
{
  "cph-ng.runner.timeAddition": 1000
}
```

**何时更改：**

- 在较慢的机器上增加
- 如果您想要更严格的计时，在快速机器上减少

### `cph-ng.runner.stdoutThreshold`

**类型：** `number`  
**默认值：** `1000`  
**单位：** 字节

内联显示的 stdout 最大大小。如果输出超过此值，将自动保存到文件。

**示例：**

```json
{
  "cph-ng.runner.stdoutThreshold": 2000
}
```

**何时更改：**

- 如果您想内联查看更多输出则增加
- 如果您想在大输出时节省内存则减少

### `cph-ng.runner.stderrThreshold`

**类型：** `number`  
**默认值：** `1000`  
**单位：** 字节

内联显示的 stderr 最大大小。如果错误输出超过此值，将自动保存到文件。

**示例：**

```json
{
  "cph-ng.runner.stderrThreshold": 1500
}
```

### `cph-ng.runner.useRunner`

**类型：** `boolean`  
**默认值：** `false`

启用高级运行器系统以获得更准确的内存测量和资源控制。

**示例：**

```json
{
  "cph-ng.runner.useRunner": true
}
```

**启用时的好处：**

- 更准确的内存使用测量
- 更好的资源限制执行
- 更精确的计时

**注意：** 在某些平台上可能需要额外的系统权限。

---

## 比较设置

控制输出与预期答案比较方式的设置。

### `cph-ng.comparing.oleSize`

**类型：** `number`  
**默认值：** `3`  
**单位：** MB

输出限制超限（OLE）状态的输出大小阈值。如果输出超过此大小，测试用例将被标记为 OLE。

**示例：**

```json
{
  "cph-ng.comparing.oleSize": 5
}
```

**何时更改：**

- 如果问题确实需要大输出则增加
- 减少以更早地捕获无限循环

### `cph-ng.comparing.regardPEAsAC`

**类型：** `boolean`  
**默认值：** `false`

启用后，格式错误（PE）被视为通过（AC）。当输出内容正确但格式不同时（例如，额外的空格）会出现 PE。

**示例：**

```json
{
  "cph-ng.comparing.regardPEAsAC": true
}
```

**何时启用：**

- 当您想忽略格式问题时
- 对于确切格式不重要的问题
- 在初始测试阶段

### `cph-ng.comparing.ignoreError`

**类型：** `boolean`  
**默认值：** `true`

启用后，比较结果时忽略 stderr 输出。只有 stdout 与预期答案进行比较。

**示例：**

```json
{
  "cph-ng.comparing.ignoreError": false
}
```

**何时禁用：**

- 调试不应产生任何 stderr 的程序时
- 当您想强制执行干净输出时

---

## 暴力对拍设置

特定于暴力比较功能的设置。

### `cph-ng.bfCompare.generatorTimeLimit`

**类型：** `number`  
**默认值：** `10`  
**单位：** 秒

测试用例生成器程序的时间限制。如果生成器运行时间超过此值，将被终止。

**示例：**

```json
{
  "cph-ng.bfCompare.generatorTimeLimit": 5
}
```

### `cph-ng.bfCompare.bruteForceTimeLimit`

**类型：** `number`  
**默认值：** `60`  
**单位：** 秒

暴力参考解法的时间限制。这可以比常规时间限制更长，因为暴力解法通常较慢。

**示例：**

```json
{
  "cph-ng.bfCompare.bruteForceTimeLimit": 120
}
```

**何时更改：**

- 对于即使暴力解法也需要很长时间的问题增加
- 如果您想在测试期间更快迭代则减少

---

## 问题设置

与问题管理和测试用例相关的设置。

### `cph-ng.problem.defaultTimeLimit`

**类型：** `number`  
**默认值：** `1000`  
**单位：** 毫秒

当 Competitive Companion 未指定时，新创建问题的默认时间限制。

**示例：**

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000
}
```

### `cph-ng.problem.defaultMemoryLimit`

**类型：** `number`  
**默认值：** `512`  
**单位：** MB

当 Competitive Companion 未指定时，新创建问题的默认内存限制。

**示例：**

```json
{
  "cph-ng.problem.defaultMemoryLimit": 256
}
```

### `cph-ng.problem.foundMatchTestCaseBehavior`

**类型：** `string`  
**默认值：** `"always"`  
**选项：** `"ask"` | `"always"` | `"never"`

控制当 CPH-NG 在工作区中找到匹配的测试用例文件时会发生什么。

- **`ask`**：提示用户是否加载找到的测试用例
- **`always`**：自动加载找到的测试用例而不提示
- **`never`**：忽略找到的测试用例

**示例：**

```json
{
  "cph-ng.problem.foundMatchTestCaseBehavior": "ask"
}
```

### `cph-ng.problem.templateFile`

**类型：** `string`  
**默认值：** `""`

代码模板文件的路径，将用作新问题的起点。

**示例：**

```json
{
  "cph-ng.problem.templateFile": "/home/user/templates/cpp_template.cpp"
}
```

### `cph-ng.problem.problemFilePath`

**类型：** `string`  
**默认值：** `"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`

存储问题数据文件（元数据和测试用例）的路径模式。

**可用变量：**

- `${workspace}`：工作区根目录
- `${relativeDirname}`：源文件相对于工作区的目录
- `${basename}`：不带扩展名的源文件名
- `${dirname}`：源文件的完整目录路径
- `${filename}`：带扩展名的源文件名
- `${tmp}`：系统临时目录
- `${home}`：用户主目录

**示例：**

```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.cph-ng/${basename}.bin"
}
```

### `cph-ng.problem.unzipFolder`

**类型：** `string`  
**默认值：** `"${workspace}/.cph-ng/${zipBasenameNoExt}"`

解压包含测试用例的 zip 文件的路径模式。

**可用变量：**

- `${workspace}`：工作区根目录
- `${zipBasenameNoExt}`：不带扩展名的 zip 文件名
- `${tmp}`：系统临时目录
- `${home}`：用户主目录

**示例：**

```json
{
  "cph-ng.problem.unzipFolder": "${tmp}/cph-testcases/${zipBasenameNoExt}"
}
```

### `cph-ng.problem.deleteAfterUnzip`

**类型：** `boolean`  
**默认值：** `false`

启用后，解压后自动删除 zip 文件。

**示例：**

```json
{
  "cph-ng.problem.deleteAfterUnzip": true
}
```

### `cph-ng.problem.clearBeforeLoad`

**类型：** `boolean`  
**默认值：** `true`

启用后，从文件/文件夹加载新测试用例之前清除现有测试用例。

**示例：**

```json
{
  "cph-ng.problem.clearBeforeLoad": false
}
```

**何时禁用：**

- 当您想合并来自多个来源的测试用例时
- 向现有测试用例添加补充测试用例时

### `cph-ng.problem.maxInlineDataLength`

**类型：** `number`  
**默认值：** `65536`  
**单位：** 字节

内联显示测试用例数据的最大大小。较大的数据会自动存储在外部文件中。

**示例：**

```json
{
  "cph-ng.problem.maxInlineDataLength": 32768
}
```

**何时更改：**

- 如果您想节省内存则减少
- 如果您更喜欢内联显示较大的测试用例则增加

---

## 缓存设置

控制编译和运行时缓存的设置。

### `cph-ng.cache.directory`

**类型：** `string`  
**默认值：** `"${tmp}/cph-ng"`

CPH-NG 存储编译的二进制文件和缓存文件的目录。

**可用变量：**

- `${tmp}`：系统临时目录
- `${home}`：用户主目录

**示例：**

```json
{
  "cph-ng.cache.directory": "${home}/.cache/cph-ng"
}
```

### `cph-ng.cache.cleanOnStartup`

**类型：** `boolean`  
**默认值：** `true`

启用后，VS Code 启动时清理缓存目录。

**示例：**

```json
{
  "cph-ng.cache.cleanOnStartup": false
}
```

**何时禁用：**

- 如果您想在 VS Code 重启之间保留编译的二进制文件
- 如果缓存清理在您的系统上导致问题

---

## CPH 兼容性设置

与原始 CPH 扩展兼容性的设置。

### `cph-ng.cphCapable.enabled`

**类型：** `boolean`  
**默认值：** `true`

启用从原始 CPH 扩展导入数据的兼容性功能。

**示例：**

```json
{
  "cph-ng.cphCapable.enabled": false
}
```

**何时禁用：**

- 如果您不是从 CPH 迁移
- 如果兼容性功能导致问题

---

## Competitive Companion 设置

与 Competitive Companion 浏览器扩展集成的设置。

### `cph-ng.companion.listenPort`

**类型：** `number`  
**默认值：** `27121`

CPH-NG 监听来自 Competitive Companion 的问题数据的端口号。

**示例：**

```json
{
  "cph-ng.companion.listenPort": 27121
}
```

**何时更改：**

- 如果端口 27121 已被另一个应用程序使用
- 确保 Competitive Companion 配置为发送到相同的端口

### `cph-ng.companion.defaultExtension`

**类型：** `string`  
**默认值：** `"cpp"`

Competitive Companion 创建的源文件的默认文件扩展名。

**示例：**

```json
{
  "cph-ng.companion.defaultExtension": "java"
}
```

**常见值：**

- `"cpp"` - C++
- `"c"` - C
- `"java"` - Java

### `cph-ng.companion.submitLanguage`

**类型：** `number`  
**默认值：** `-1`  
**选项：** `-1`（提示）| `54`（C++17）| `89`（C++20）| `91`（C++23）

提交到 Codeforces 的默认语言 ID。

- **`-1`**：每次提示选择语言
- **`54`**：C++17（GCC 64 位）
- **`89`**：C++20（GCC 64 位）
- **`91`**：C++23（GCC 64 位）

**示例：**

```json
{
  "cph-ng.companion.submitLanguage": 89
}
```

### `cph-ng.companion.addTimestamp`

**类型：** `boolean`  
**默认值：** `true`

启用后，在文件名中添加时间戳以避免快速连续导入多个问题时的冲突。

**示例：**

```json
{
  "cph-ng.companion.addTimestamp": false
}
```

### `cph-ng.companion.chooseSaveFolder`

**类型：** `boolean`  
**默认值：** `false`

启用后，每次从 Competitive Companion 导入问题时都会提示保存位置。

**示例：**

```json
{
  "cph-ng.companion.chooseSaveFolder": true
}
```

### `cph-ng.companion.showPanel`

**类型：** `number`  
**默认值：** `-1`

控制从 Competitive Companion 导入后何时显示 CPH-NG 面板。

**选项：**

- **`-1`**：始终显示
- **`-2`**：从不显示
- **`1-9`**：在特定编辑器列中显示

**示例：**

```json
{
  "cph-ng.companion.showPanel": -1
}
```

### `cph-ng.companion.shortCodeforcesName`

**类型：** `boolean`  
**默认值：** `true`

对 Codeforces 问题使用较短的文件名（例如，"A" 而不是 "A - 问题标题"）。

**示例：**

```json
{
  "cph-ng.companion.shortCodeforcesName": true
}
```

### `cph-ng.companion.shortLuoguName`

**类型：** `boolean`  
**默认值：** `true`

对洛谷问题使用较短的文件名。

**示例：**

```json
{
  "cph-ng.companion.shortLuoguName": true
}
```

### `cph-ng.companion.shortAtCoderName`

**类型：** `boolean`  
**默认值：** `true`

对 AtCoder 问题使用较短的文件名。

**示例：**

```json
{
  "cph-ng.companion.shortAtCoderName": true
}
```

---

## 侧边栏设置

控制 CPH-NG 侧边栏面板外观和行为的设置。

### `cph-ng.sidebar.retainWhenHidden`

**类型：** `boolean`  
**默认值：** `true`

启用后，即使隐藏也会保留侧边栏面板状态。这可以防止在面板之间切换时丢失您的工作。

**示例：**

```json
{
  "cph-ng.sidebar.retainWhenHidden": false
}
```

### `cph-ng.sidebar.showAcGif`

**类型：** `boolean`  
**默认值：** `true`

启用后，当所有测试用例通过（AC）时显示庆祝 GIF。

**示例：**

```json
{
  "cph-ng.sidebar.showAcGif": false
}
```

### `cph-ng.sidebar.colorTheme`

**类型：** `string`  
**默认值：** `"auto"`  
**选项：** `"auto"` | `"light"` | `"dark"`

控制侧边栏面板的颜色主题。

- **`auto`**：跟随 VS Code 主题
- **`light`**：始终使用浅色主题
- **`dark`**：始终使用深色主题

**示例：**

```json
{
  "cph-ng.sidebar.colorTheme": "dark"
}
```

### `cph-ng.sidebar.hiddenStatuses`

**类型：** `array`  
**默认值：** `[]`

在 UI 中隐藏的状态代码数组。当某些状态与您无关时，用于整理界面。

**可用状态代码：**

- `UKE`, `AC`, `PC`, `PE`, `WA`, `TLE`, `MLE`, `OLE`, `RE`, `RF`
- `CE`, `SE`, `WT`, `FC`, `CP`, `CPD`, `JG`, `JGD`, `CMP`, `SK`, `RJ`

**示例：**

```json
{
  "cph-ng.sidebar.hiddenStatuses": ["WT", "FC", "CP", "CPD", "JG", "JGD", "CMP"]
}
```

### `cph-ng.sidebar.showTips`

**类型：** `boolean`  
**默认值：** `true`

启用后，在没有加载问题时在侧边栏显示有用的提示。

**示例：**

```json
{
  "cph-ng.sidebar.showTips": false
}
```

### `cph-ng.sidebar.fontFamily`

**类型：** `string`  
**默认值：** `""`

侧边栏面板的自定义字体系列。留空以使用 VS Code 的默认字体。

**示例：**

```json
{
  "cph-ng.sidebar.fontFamily": "Fira Code, monospace"
}
```

---

## 配置示例

### 竞争性编程设置

针对 Codeforces/AtCoder 风格比赛的优化：

```json
{
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall -DCPH",
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.companion.addTimestamp": true,
  "cph-ng.comparing.regardPEAsAC": false,
  "cph-ng.sidebar.showAcGif": true
}
```

### 调试设置

用于调试和开发的配置：

```json
{
  "cph-ng.compilation.cppArgs": "-O0 -std=c++20 -Wall -g -fsanitize=address -fsanitize=undefined -DCPH",
  "cph-ng.runner.useRunner": true,
  "cph-ng.comparing.ignoreError": false,
  "cph-ng.sidebar.hiddenStatuses": []
}
```

### 性能优先设置

用于比赛期间快速迭代：

```json
{
  "cph-ng.compilation.timeout": 5000,
  "cph-ng.cache.cleanOnStartup": false,
  "cph-ng.runner.timeAddition": 500,
  "cph-ng.problem.clearBeforeLoad": true
}
```

---

## 路径变量参考

许多设置支持路径变量以提供灵活性：

| 变量 | 描述 | 示例 |
|----------|-------------|---------|
| `${workspace}` | 当前工作区根目录 | `/home/user/projects/contest` |
| `${tmp}` | 系统临时目录 | `/tmp` |
| `${home}` | 用户主目录 | `/home/user` |
| `${basename}` | 不带扩展名的文件名 | `problem_a` |
| `${filename}` | 带扩展名的文件名 | `problem_a.cpp` |
| `${dirname}` | 完整目录路径 | `/home/user/projects/contest` |
| `${relativeDirname}` | 相对于工作区的目录 | `contest1` |
| `${zipBasenameNoExt}` | 不带扩展名的 zip 文件名 | `testcases` |

---

## 获取帮助

- 如果设置未按预期工作，请查看[常见问题](faq.md)
- 有关详细功能信息，请参阅[功能指南](features.md)
- 在 [GitHub](https://github.com/langningchen/cph-ng/issues) 上报告问题

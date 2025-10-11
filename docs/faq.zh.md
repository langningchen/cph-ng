# 常见问题

## 一般问题

### 什么是 CPH-NG？

CPH-NG（Competitive Programming Helper - Next Generation，竞争性编程助手 - 新一代）是一个用于竞争性编程的 VS Code 扩展。它帮助您在本地编译、运行和评测您的解决方案，测试用例可以从在线评测网站导入或手动创建。

查看[概述](index.md)了解更多信息。

### CPH-NG 与原版 CPH 有何不同？

CPH-NG 是一个完全重写的版本，包含许多增强功能：

- 更多的评测状态（21 种 vs 3 种）
- 编译缓存以加快测试速度
- 支持从文件和文件夹加载测试用例
- 特殊评测（SPJ）和交互式问题支持
- 暴力对拍
- 更好的内存管理

查看 [README](https://github.com/langningchen/cph-ng#comparison-with-cph) 中的对比表。

### CPH-NG 支持哪些语言？

目前，CPH-NG 支持：

- C++（推荐用于竞争性编程）
- C
- Java

未来版本可能会添加更多语言。

## 安装与设置

### 在哪里可以下载 CPH-NG？

直接从 VS Code 安装：

1. 打开 VS Code
2. 转到扩展（Ctrl/Cmd+Shift+X）
3. 搜索"CPH NG"
4. 点击安装

或使用此直接链接：[安装 CPH-NG](vscode:extension/langningchen.cph-ng)

### 如何配置我的编译器？

1. 打开 VS Code 设置（Ctrl/Cmd+,）
2. 搜索"cph-ng compilation"
3. 配置编译器路径和标志

查看[编译设置](configuration.md#编译设置)了解详情。

### 可以使用自定义代码模板吗？

可以！在设置中设置模板文件路径：

```json
{
  "cph-ng.problem.templateFile": "/path/to/your/template.cpp"
}
```

查看[问题设置](configuration.md#问题设置)了解更多选项。

## 使用 CPH-NG

### 如何创建新问题？

三种方式：

1. 点击侧边栏中的"CREATE"
2. 使用命令面板：`CPH-NG: Create Problem`
3. 使用键盘快捷键：`Ctrl+Alt+B`（macOS 上为 `Cmd+Alt+B`）

查看[快速入门](quickStart.md#创建问题)了解详情。

### 如何从在线评测网站导入问题？

1. 安装 [Competitive Companion](https://github.com/jmerle/competitive-companion) 浏览器扩展
2. 转到支持的评测网站上的问题（Codeforces、AtCoder 等）
3. 点击 Competitive Companion 图标
4. CPH-NG 将自动创建带有测试用例的问题

查看[功能指南 - Competitive Companion](features.md#从-competitive-companion-导入)了解配置选项。

### 如何从文件加载测试用例？

1. 点击问题面板中的文件夹图标
2. 选择"从 zip 文件加载"或"从文件夹加载"
3. 选择您的文件/文件夹
4. 选择要导入的测试用例

CPH-NG 自动按名称匹配 `.in` 文件与 `.out`/`.ans` 文件。

查看[功能指南 - 从文件加载](features.md#从文件文件夹加载测试用例)了解详情。

### 为什么我的程序无法编译？

常见问题：

1. **找不到编译器**：检查设置中的编译器路径
2. **编译超时**：在[编译设置](configuration.md#编译设置)中增加超时时间
3. **语法错误**：查看编译输出面板

### 为什么我的解决方案应该通过却得到 TLE？

可能的原因：

1. **机器较慢**：在[运行器设置](configuration.md#运行器设置)中增加 `timeAddition`
2. **实际的无限循环**：检查您的代码逻辑
3. **时间限制过于严格**：编辑问题元数据以增加时间限制

### 如何使用特殊评测？

1. 编写检查器程序（使用 testlib.h 或自定义）
2. 编译您的检查器
3. 点击笔形图标编辑问题元数据
4. 点击"Choose Checker"并选择您编译的检查器

查看[功能指南 - 特殊评测](features.md#特殊评测)了解要求和示例。

## 高级功能

### 什么是暴力对拍？

暴力对拍通过以下方式帮助找到边界情况：

1. 生成随机测试输入
2. 同时运行您的优化解法和暴力参考解法
3. 比较输出直到它们不同
4. 将失败的用例保存为测试用例

查看[功能指南 - 暴力对拍](features.md#暴力对拍)了解设置说明。

### 编译缓存如何工作？

CPH-NG 计算源代码和编译器设置的哈希值。如果自上次编译以来没有任何变化，它会重用缓存的二进制文件，节省时间。

这是自动的，不需要配置。

### 可以自定义存储问题的文件夹吗？

可以！在设置中配置路径模式：

```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.cph-ng/${basename}.bin"
}
```

查看[问题设置](configuration.md#问题设置)了解可用变量。

### 如何隐藏某些评测状态？

在设置中配置隐藏状态：

```json
{
  "cph-ng.sidebar.hiddenStatuses": ["WT", "FC", "CP", "CPD"]
}
```

查看[侧边栏设置](configuration.md#侧边栏设置)了解完整的状态代码列表。

## 故障排除

### 侧边栏面板未显示

1. 检查 CPH-NG 图标是否在活动栏中
2. 点击图标打开面板
3. 如果仍未显示，尝试重新加载 VS Code（Ctrl/Cmd+Shift+P → "Developer: Reload Window"）

### 测试用例无法运行

1. 确保文件已保存
2. 检查编译是否成功
3. 在编译输出面板中查找错误
4. 验证编译器设置是否正确

### 内存测量不准确

启用高级运行器：

```json
{
  "cph-ng.runner.useRunner": true
}
```

注意：可能需要额外的系统权限。

查看[运行器设置](configuration.md#运行器设置)了解详情。

### 输出太大无法显示

大输出会自动保存到文件。您可以：

1. 点击文件名查看内容
2. 使用文件图标在文件和内联显示之间切换
3. 在[运行器设置](configuration.md#运行器设置)中调整阈值

### 在 Linux/macOS 上遇到权限错误

某些功能可能需要：

1. 编译器的可执行权限
2. 缓存目录的写入权限
3. 在工作区中创建文件的权限

检查您的系统权限和文件所有权。

## 获取帮助

### 在哪里报告错误？

在 [GitHub Issues](https://github.com/langningchen/cph-ng/issues) 上报告错误。

请包含：

- 您的操作系统和 VS Code 版本
- CPH-NG 版本
- 重现步骤
- 错误消息或屏幕截图

### 在哪里请求功能？

欢迎在 [GitHub Discussions](https://github.com/langningchen/cph-ng/discussions) 上提出功能请求。

### 如何贡献？

欢迎贡献！查看[关于](about.md#contributing)页面了解如何贡献的信息。

### 在哪里可以找到源代码？

CPH-NG 是开源的：[GitHub 仓库](https://github.com/langningchen/cph-ng)

## 其他资源

- [功能指南](features.md) - 所有功能的全面指南
- [配置参考](configuration.md) - 所有配置选项
- [快速入门](quickStart.md) - 快速开始
- [模块](modules.md) - 额外功能
- [关于](about.md) - 项目信息

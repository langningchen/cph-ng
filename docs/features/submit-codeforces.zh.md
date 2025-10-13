# 提交到 Codeforces

直接提交到 Codeforces 在线评测。

## 概述

提交到 Codeforces 功能允许您直接从 VS Code 内将解法提交到 Codeforces，无需打开浏览器。

## 用户交互

### 触发

**提交按钮**：
- 仅当题目 URL 来自 Codeforces 时出现
- 图标：上传/备份图标
- 颜色：绿色（成功）
- 点击开始提交

### 前置条件

- 题目必须具有有效的 Codeforces URL
- 必须在浏览器中登录 Codeforces
- 必须保存源文件

## 工作原理

1. 点击提交按钮
2. 扩展从 URL 提取竞赛/题目 ID
3. 打开浏览器进行身份验证
4. 将代码提交到 Codeforces
5. 显示确认

## 配置

### 语言选择

#### `cph-ng.companion.submitLanguage`
- 为 Codeforces 选择 C++ 编译器版本
- 选项：GCC、Clang、MSVC 版本

## 相关功能

- [编辑题目](edit-problem.md) - 设置题目 URL
- [Competitive Companion](competitive-companion.md) - 从 Codeforces 自动导入

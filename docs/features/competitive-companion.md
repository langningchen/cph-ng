**此页面由 AI 生成且未经人工审核，可能包含错误。因人工过于繁忙，暂时无法进行校对。**

# Competitive Companion 集成

浏览器扩展集成，用于从在线评测自动导入题目。

## 概述

Competitive
Companion 是一个浏览器扩展，可将在线评测的题目数据直接发送到 CPH-NG。在任何题目页面上点击扩展图标即可自动导入所有测试样例和元数据。

## 用户交互

### 设置

1. 安装 Competitive Companion 浏览器扩展
2. 在 CPH-NG 设置中配置监听端口（默认：27121）
3. 在 VSCode 中打开源文件
4. 导航到在线评测上的题目
5. 点击 Competitive Companion 图标
6. 在 CPH-NG 中自动创建题目

### 支持的评测

- Codeforces
- AtCoder
- LeetCode
- Codechef
- CSES
- 以及更多

## 配置

### 端口设置

#### `cph-ng.companion.listenPort`

- **默认值**：`27121`
- 浏览器扩展发送到此端口

## 工作原理

1. 用户点击题目页面上的扩展图标
2. 扩展将 JSON 数据发送到 CPH-NG
3. CPH-NG 接收题目元数据和测试样例
4. 创建新文件（或打开现有文件）
5. 导入带有所有测试样例的题目
6. 准备开始编码

## 相关功能

- [创建题目](create-problem.md) - 手动创建题目
- [导入题目](import-problem.md) - 从 CPH 导入

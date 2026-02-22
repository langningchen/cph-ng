**此页面由 AI 生成且未经人工审核，可能包含错误。因人工过于繁忙，暂时无法进行校对。**

# Companion 设置

Competitive Companion 浏览器扩展集成的设置。

## 监听端口

### `cph-ng.companion.listenPort`

- **类型**：数字
- **默认值**：`27121`
- **用户影响**：CPH-NG 监听来自浏览器扩展的连接的端口。必须与 Competitive
  Companion 配置匹配。

## 文件保存

### `cph-ng.companion.showPanel`

- **类型**：数字（枚举）
- **默认值**：`0`
- **用户影响**：控制题目来源文件面板的可见性。

### `cph-ng.companion.addTimestamp`

- **类型**：数字（枚举）
- **默认值**：`0`
- **用户影响**：是否在文件名中添加时间戳。

## 提交语言

### `cph-ng.companion.submitLanguage`

- **类型**：数字（枚举）
- **默认值**：根据评测而定
- **用户影响**：提交到 Codeforces 时使用的编译器版本。

## 工作原理

使用 Competitive Companion 时：

1. 在评测网站上点击浏览器扩展图标
2. 扩展向 `listenPort` 发送题目数据
3. CPH-NG 接收题目元数据和测试样例
4. 创建具有 `defaultExtension` 的新文件
5. 题目数据保存在 `.cph-ng/` 中

## 磁盘操作

导入题目时创建：

- 源文件：在工作区根或选定文件夹中
- 题目数据：`.cph-ng/{filename}.bin`
- 测试样例：内联或外部文件

## 相关功能

- [Competitive Companion](../features/competitive-companion.md) - 主要功能文档
- [提交到 Codeforces](../features/submit-codeforces.md) - 使用 submitLanguage

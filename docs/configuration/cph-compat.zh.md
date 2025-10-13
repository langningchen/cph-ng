# CPH 兼容性设置

与原始 CPH 扩展集成的设置。

## CPH 检查

### `cph-ng.cphCapable.enabled`
- **类型**：布尔值
- **默认值**：`true`
- **用户影响**：启用时，CPH-NG 检查 CPH 题目文件并允许导入它们。

### `cph-ng.cphCapable.checkInterval`
- **类型**：数字
- **默认值**：`500`（毫秒）
- **用户影响**：检查 CPH 题目文件存在性的频率。

## 工作原理

启用 CPH 兼容性时：
1. CPH-NG 监视 CPH 题目文件（`.cph/` 文件夹）
2. 如果检测到 CPH 题目，显示导入按钮
3. 用户可以将 CPH 题目转换为 CPH-NG 格式
4. 转换保留所有测试用例和元数据

## 磁盘操作

CPH 文件位置：
- 原始：`.cph/{filename}.prob`
- 检测：定期检查此位置
- 导入：转换为 CPH-NG 格式
- 保存：在 `.cph-ng/` 中的新格式

## 何时禁用

- 不使用原始 CPH
- 减少后台检查
- 性能原因

## 相关功能
- [导入题目](../features/import-problem.md) - 单个 CPH 题目导入
- [CPH 导入](../features/cph-import.md) - 批量 CPH 导入

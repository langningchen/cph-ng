# 题目设置

题目默认值和文件路径的设置。

## 默认限制

### `cph-ng.problem.defaultTimeLimit`
- **类型**：数字
- **默认值**：`1000`（毫秒）
- **用户影响**：新题目的默认时间限制。

### `cph-ng.problem.defaultMemoryLimit`
- **类型**：数字
- **默认值**：`512`（MB）
- **用户影响**：新题目的默认内存限制。

## 文件路径

### `cph-ng.problem.problemFilePath`
- **类型**：字符串
- **默认值**：`"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`
- **用户影响**：题目数据文件的存储位置。支持路径变量。

**示例**：
```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.problems/${basename}.bin"
}
```

## 测试用例加载

### `cph-ng.problem.clearBeforeImport`
- **类型**：布尔值
- **默认值**：`false`
- **用户影响**：加载测试用例前是否清除现有测试用例。

### `cph-ng.problem.deleteAfterUnzip`
- **类型**：布尔值
- **默认值**：`false`
- **用户影响**：解压后是否删除 zip 文件。

### `cph-ng.problem.maxInlineDataLength`
- **类型**：数字
- **默认值**：`65536`（字节）
- **用户影响**：内联数据的最大大小。超过时自动转换为文件存储。

## 磁盘操作

题目数据存储在：
- 位置：由 `problemFilePath` 确定
- 格式：二进制文件（`.bin`）
- 内容：元数据、测试用例、配置
- 测试用例：内联或外部文件

## 相关功能
- [创建题目](../features/create-problem.md) - 使用默认限制
- [加载测试用例](../features/load-test-cases.md) - 使用导入设置
- [切换文件/内联](../features/toggle-file-inline.md) - 受 maxInlineDataLength 影响

# 比较设置

控制测试输出如何与预期答案进行比较的设置。

## 输出超限

### `cph-ng.comparing.oleSize`

检测输出超限的阈值（以行为单位）。

- **类型**：数字
- **默认值**：`3`
- **用户影响**：如果实际输出与预期答案相比有超过这么多额外行，判决将变为 OLE（输出超限）而不是 WA（答案错误）。

**示例**：
```json
{
  "cph-ng.comparing.oleSize": 5
}
```

*有 6+ 额外行的输出获得 OLE 而不是 WA。*

## 格式错误

### `cph-ng.comparing.regardPEAsAC`

将格式错误（尾随/前导空白差异）视为接受。

- **类型**：布尔值
- **默认值**：`false`
- **用户影响**：
  - `false`：行尾额外空白或额外空行导致 PE 判决
  - `true`：忽略空白差异，判决变为 AC

**示例**：
```json
{
  "cph-ng.comparing.regardPEAsAC": true
}
```

*尾随空格和额外空行不会导致 PE 判决。*

!!! tip "竞技编程"
    大多数在线评测对空白宽容。将此设置为 `true` 匹配典型评测行为。

## 错误输出处理

### `cph-ng.comparing.ignoreError`

控制在判决中是否考虑 stderr 输出。

- **类型**：布尔值
- **默认值**：`true`
- **用户影响**：
  - `true`：程序可以写入 stderr 而不影响判决（调试输出常见）
  - `false`：任何 stderr 输出导致不同判决或警告

**示例**：
```json
{
  "cph-ng.comparing.ignoreError": false
}
```

*写入 stderr 的程序将被标记。*

!!! note "调试输出"
    保持此为 `true` 允许在 C++ 中使用 `cerr` 进行调试而不影响正确性检查。

## 比较行为

比较过程如下：

1. **精确匹配**：输出完全匹配答案 → **AC**（接受）
2. **空白差异**：尾随/前导空格不同 → **PE**（格式错误），或如果 `regardPEAsAC` 为 true 则为 **AC**
3. **内容错误**：输出内容不同 → **WA**（答案错误）
4. **输出过多**：超过 `oleSize` 额外行 → **OLE**（输出超限）
5. **运行时错误**：程序崩溃或返回非零退出代码 → **RE**（运行时错误）
6. **时间限制**：执行超过时间限制 → **TLE**（超时）
7. **内存限制**：内存使用超过限制（如果启用运行器）→ **MLE**（内存超限）

## 何时更改这些设置

**将 `regardPEAsAC` 设置为 true**：
- 为忽略空白的在线评测做准备
- 不想担心输出格式
- 专注于算法正确性

**将 `regardPEAsAC` 设置为 false**：
- 需要精确的输出格式匹配
- 测试输出格式要求
- 为严格格式比赛做准备

**将 `ignoreError` 设置为 false**：
- 调试不应写入 stderr 的程序
- 想要捕获所有诊断输出
- 测试代码质量

**调整 `oleSize`**：
- 收到不正确的 OLE 判决
- 想要更严格或更宽松的检测

## 相关功能

- [比较输出](../features/compare-output.md) - WA/PE 情况的可视化差异
- [运行单个测试](../features/run-single-test.md) - 使用这些比较规则
- [运行所有测试](../features/run-all-tests.md) - 应用于所有测试比较
- [特殊评测](../features/special-judge.md) - 覆盖标准比较

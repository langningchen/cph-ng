---
hide:
  - navigation
---

# CPH-NG

> **专为竞赛编程优化的 VSCode 扩展，让你的编程效率显著提升**

智能测试数据管理 | 21 种精细评测状态 | Special Judge支持 | 自动化对拍

CPH-NG[^1] 是一个专为竞争性编程开发的 **Visual Studio Code 扩展**。

[^1]: CPH-NG 英文全称 `Competitive Programming Helper - Next Generation`，中文全称翻译可以理解为 `新一代竞争性编程助手`

CPH-NG 使用户能够在 VSCode 环境中方便高效地**编译、运行和评测**程序。

!!! warning "语言支持限制"
    目前 CPH-NG 仅支持 C++，Java 和 Python (PyPy)，如果需要支持更多语言，欢迎提出建议。

![CPH-NG 主界面](images/cphNg.png){ width=800 loading=lazy }
/// caption
CPH-NG 主界面展示 - 现代化的竞赛编程环境
///

## 什么是 CPH-NG？ { #introduction }

CPH-NG 是 [Competitive Programming Helper](https://github.com/agrawal-d/cph) 的下一代版本，为在 VSCode 中工作的竞争性程序员提供全面的解决方案。无论您是在在线评测网站上练习还是处理自己的题目，CPH-NG 都能简化从题目创建到提交的整个工作流程。

## 为什么选择 CPH-NG？

传统 CPH 虽然为竞赛编程提供了基础支持，但在实际使用中仍存在诸多痛点：

- **批量测试数据管理功能不足** - 无法高效处理大量测试样例
- **评测状态信息有限** - 难以精确定位问题类型和错误原因
- **不支持 Special Judge 或者交互题** - 无法处理多解问题和特殊评测需求
- **缺乏智能编译缓存** - 重复编译效率低下，浪费开发时间
- **配置选项相对固定** - 个性化程度有限，难以适应不同使用场景
- **界面功能冗余** - 在线人数、捐赠广告等功能影响专注度

## 安装 { #installation }

- 在 VSCode 扩展面板中搜索 `CPH-NG`
- 从 Visual Studio Code 市场直接安装 <https://marketplace.visualstudio.com/items?itemName=langningchen.cph-ng>

## 核心功能特性 { #features }

### 智能测试数据管理 { #data-management }

![测试数据管理界面](https://image.langningchen.com/hrqkcnygjudprbptzlhfhehywykxppfp){ width=800 loading=lazy }
/// caption
多种测试数据导入方式 - 让数据管理变得简单高效
///

CPH-NG 提供多种灵活的测试数据导入方式：

- **压缩包解析**：支持从 `.zip` 格式测试数据包的自动解压和匹配
- **目录批量导入**：自动识别和配对输入输出文件
- **Competitive Companion 浏览器插件**：在浏览器中一键点击即可导入
- **智能文件匹配**：手动选择输入文件时自动匹配同目录下的输出文件
- **对拍导入**：在运行对拍时自动导入对拍出错的数据
- **手工输入**：支持直接在界面输入测试数据

### 智能编译系统 { #intelligent-compilation }

CPH-NG 的智能编译系统为所有源代码提供编译优化：

- **哈希值检测**：自动计算文件哈希值，判断文件是否发生变化
- **智能缓存**：根据变化情况决定是否需要重新编译
- **手动控制**：按住 `Ctrl` 强制重新编译，或按 `Alt` 跳过编译
- **多文件支持**：题目代码、SPJ 代码等所有源代码文件均享受优化

### 精细化评测状态系统 { #detailed-judging-status }

![评测状态展示](https://image.langningchen.com/rjdhfocjbskyrwlubgccyezkfudherch){ width=800 loading=lazy }
/// caption
21 种评测状态 - 精确定位问题所在
///

CPH-NG 实现了完整的 21 种评测状态，提供精确的程序问题诊断。相比传统 CPH 的基础状态，CPH-NG 提供了 **7 倍** 的状态精度，帮助您快速定位代码问题。

| 简写代码 | 含义 | 简写代码 | 含义 | 简写代码 | 含义 |
| -------- | -------- | -------- | -------- | -------- | -------- |
| :material-checkbox-blank-circle:{ style="color: #0000ff" } UKE | 未知错误 (Unknown Error) | :material-checkbox-blank-circle:{ style="color: #8300a7" } OLE | 输出超限 (Output Limit Exceed) | :material-checkbox-blank-circle:{ style="color: #5e19ff" } CP | 正在编译 (Compiling) |
| :material-checkbox-blank-circle:{ style="color: #49cd32" } AC | 通过 (Accepted) | :material-checkbox-blank-circle:{ style="color: #1a26c8" } RE | 运行时错误 (Runtime Error) | :material-checkbox-blank-circle:{ style="color: #7340ff" } CPD | 已编译 (Compiled) |
| :material-checkbox-blank-circle:{ style="color: #ed9813" } PC | 部分正确 (Partially Correct) | :material-checkbox-blank-circle:{ style="color: #008f81" } RF | 受限函数 (Restricted Function) | :material-checkbox-blank-circle:{ style="color: #844fff" } JG | 正在评测 (Judging) |
| :material-checkbox-blank-circle:{ style="color: #ff778e" } PE | 格式错误 (Presentation Error) | :material-checkbox-blank-circle:{ style="color: #8b7400" } CE | 编译错误 (Compilation Error) | :material-checkbox-blank-circle:{ style="color: #967fff" } JGD | 已评测 (Judged) |
| :material-checkbox-blank-circle:{ style="color: #d3140d" } WA | 答案错误 (Wrong Answer) | :material-checkbox-blank-circle:{ style="color: #000000" } SE | 系统错误 (System Error) | :material-checkbox-blank-circle:{ style="color: #a87dff" } CMP | 正在比较 (Comparing) |
| :material-checkbox-blank-circle:{ style="color: #0c0066" } TLE | 时间超限 (Time Limit Exceed) | :material-checkbox-blank-circle:{ style="color: #4100d9" } WT | 等待中 (Waiting) | :material-checkbox-blank-circle:{ style="color: #4b4b4b" } SK | 已跳过 (Skipped) |
| :material-checkbox-blank-circle:{ style="color: #5300a7" } MLE | 内存超限 (Memory Limit Exceed) | :material-checkbox-blank-circle:{ style="color: #4c00ff" } FC | 已获取 (Fetched) | :material-checkbox-blank-circle:{ style="color: #4e0000" } RJ | 已拒绝 (Rejected) |

### Special Judge 支持 { #special-judge }

![Special Judge 配置](https://image.langningchen.com/lkwkwlbcxpkdjujcodgoiibihjfwvert){ width=800 loading=lazy }
/// caption
完整的 `testlib` 框架支持 - 处理多解问题
///

完整支持基于 `testlib` 框架的 Special Judge 功能：

- **多解问题处理**：完美支持排列组合、构造类题目的多种正确答案
- **浮点精度控制**：精确处理几何计算、数值分析中的浮点数比较
- **交互式评测**：支持需要程序与评测器交互的特殊题目类型

### 智能输出 { #intelligent-output }

![智能输出示例](https://image.langningchen.com/juchekftksjtejthpqjeyvxondooszly){ width=800 loading=lazy }
/// caption
支持彩色输出和长输出自动放置文件
///

- **彩色输出**：可以通过 ANSI 转义序列实现彩色输出，提升调试信息的可读性
- **长输出自动放置文件**：对于过长的输出，自动放置在文件中

### 自动化对拍功能 { #automated-stress-test }

![对拍功能演示](https://image.langningchen.com/wsxcvepxsemzhexjlbopvtzdbqdooogb){ width=800 loading=lazy }
/// caption
自动化对拍 - 让程序正确性验证变得简单
///

提供完整的程序正确性验证流程：

- **数据生成器集成**：支持自定义随机数据生成程序
- **标准程序对比**：与暴力解法或标准实现自动对比
- **错误用例捕获**：自动保存导致程序错误的测试数据
- **批量验证**：大规模随机数据验证程序正确性

### 灵活的配置系统 { #flexible-configuration }

![配置界面](https://image.langningchen.com/khxxrzjccijnfltgnaibcydsqqjvkmkt){ width=800 loading=lazy }
/// caption
丰富的配置选项 - 适应不同使用场景
///

CPH-NG 提供丰富的配置选项以适应不同使用场景：

- **编译器配置**：自定义编译器路径、编译选项和优化参数
- **运行策略调整**：配置运行缓冲时限和性能监控选项
- **运行结果比较方法**：自定义 OLE 的长度、PE 的空格和换行符处理等
- **界面个性化**：支持多语言切换、亮暗色主题显示

### 数据持久化 { #data-persistence }

完整的工作状态保存：

- **测试样例缓存**：所有测试数据和结果持久化存储
- **会话恢复**：重新打开文件时自动恢复所有测试状态
- **项目级管理**：每个源文件独立维护其测试环境

## CPH-NG 技术优势 { #technical-advantages }

### 功能对比分析 { #feature-comparison }

| 技术特性         | 传统 CPH     | CPH-NG            | 技术改进                   |
| ---------------- | ------------ | ----------------- | -------------------------- |
| **评测状态精度** | :material-close:{ style="color: #EF5350" } 基础状态识别 | :material-check:{ style="color: #4DB6AC" } 21 种专业状态     | 7 倍精度提升，精确问题定位 |
| **SPJ 支持**     | :material-close:{ style="color: #EF5350" } 不支持       | :material-check:{ style="color: #4DB6AC" } 完整 testlib 支持 | 支持多解问题和交互式评测   |
| **性能监控**     | :material-close:{ style="color: #EF5350" } 基础时间显示 | :material-check:{ style="color: #4DB6AC" } 毫秒级精确计时    | 详细性能分析和瓶颈识别     |
| **数据管理**     | :material-close:{ style="color: #EF5350" } 手动管理     | :material-check:{ style="color: #4DB6AC" } 智能批量导入      | 10 倍以上效率提升          |
| **编译优化**     | :material-close:{ style="color: #EF5350" } 每次重新编译 | :material-check:{ style="color: #4DB6AC" } 哈希缓存机制      | 90% 编译时间节省           |
| **自动化测试**   | :material-close:{ style="color: #EF5350" } 不支持       | :material-check:{ style="color: #4DB6AC" } 完整对拍功能      | 自动化正确性验证           |
| **配置灵活性**   | :material-close:{ style="color: #EF5350" } 基本固定配置 | :material-check:{ style="color: #4DB6AC" } 丰富配置选项      | 适应多种使用场景           |
| **数据持久化**   | :material-close:{ style="color: #EF5350" } 不保存状态   | :material-check:{ style="color: #4DB6AC" } 完整状态保存      | 工作状态无缝恢复           |

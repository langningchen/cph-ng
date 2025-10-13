# 特殊评测

使用自定义检查器程序进行非标准答案验证。

## 概述

特殊评测（SPJ）允许具有多个正确答案或自定义验证逻辑的题目。检查器程序根据题目要求验证输出是否正确，而不是精确匹配输出。

## 用户交互

### 设置

1. 点击题目标题中的编辑图标
2. 在编辑对话框中，找到"检查器"部分
3. 点击"选择检查器"
4. 选择编译的检查器可执行文件
5. 保存更改

### 要求

- 检查器必须是编译的可执行文件
- 应遵循 testlib.h 约定（推荐）
- 接收测试输入、选手输出和预期答案作为参数

## 工作原理

配置 SPJ 后：
1. 您的解法正常运行
2. 调用检查器而不是直接比较
3. 检查器接收：输入文件、输出文件、答案文件
4. 检查器退出代码：0（AC）、1（WA）或其他
5. 由检查器的退出代码确定判决

## 检查器程序结构

典型检查器（C++ 使用 testlib.h）：
```cpp
#include "testlib.h"
int main(int argc, char* argv[]) {
    registerTestlibCmd(argc, argv);
    int expected = ans.readInt();
    int output = ouf.readInt();
    if (output == expected)
        quitf(_ok, "Correct");
    else
        quitf(_wa, "Wrong answer");
}
```

## 相关功能

- [编辑题目](edit-problem.md) - 配置 SPJ
- [交互式题目](interactive-problems.md) - 双向通信的替代方案

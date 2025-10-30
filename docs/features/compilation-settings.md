# 题目单独的编译选项

为每个题目配置特定的编译选项，覆盖全局编译设置。

## 描述 { #description }

题目单独的编译选项功能允许您为每个题目设置专用的编译参数。这对于需要特殊编译标志或不同编译器版本的题目特别有用。这些设置会覆盖全局配置，并且只应用于该特定题目。

系统会根据源文件的扩展名自动识别编程语言，因此您只需设置适用于当前题目语言的选项即可。

## 交互 { #interaction }

### 触发功能 { #dispatch }

1. 将鼠标悬停在题目标题栏上，然后点击编辑按钮
2. 在编辑题目对话框中，向下滚动到"编译选项"部分
3. 填写您需要的编译选项字段（根据题目的编程语言）：
   - **编译器**: 编译器路径 (例如 C++: `g++`, C: `gcc`, Java: `javac`)
   - **编译参数**: 编译的额外参数 (例如 C++: `-O2 -std=c++17 -Wall -DCPH`)
   - **运行器**: 运行器路径（主要用于 Java，例如: `java`）
   - **运行参数**: 运行时的额外参数

4. 留空的字段将使用全局配置
5. 点击"保存"按钮应用更改

### 前置条件 { #requirements }

- 当前文件必须已加载题目
- 题目面板必须在侧边栏中可见

## 使用场景 { #use-cases }

### 特殊编译标准

某些题目可能需要特定的 C++ 标准。例如，如果一个题目需要 C++17 特性：

```
编译参数: -O2 -std=c++17 -Wall -DCPH
```

### 额外的调试标志

为特定题目添加调试标志：

```
编译参数: -O2 -std=c++14 -Wall -DCPH -fsanitize=address
```

### 不同的编译器

使用 clang 而不是 g++：

```
编译器: clang++
编译参数: -O2 -std=c++14 -Wall -DCPH
```

## 相关配置 { #configurations }

全局编译设置可在 VS Code 设置中配置。题目的编译选项会覆盖对应语言的全局设置：

- C 语言: [cph-ng.compilation.cCompiler](../configuration/compilation.md#cCompiler), [cph-ng.compilation.cArgs](../configuration/compilation.md#cArgs)
- C++ 语言: [cph-ng.compilation.cppCompiler](../configuration/compilation.md#cppCompiler), [cph-ng.compilation.cppArgs](../configuration/compilation.md#cppArgs)
- Java 语言: [cph-ng.compilation.javaCompiler](../configuration/compilation.md#javaCompiler), [cph-ng.compilation.javaArgs](../configuration/compilation.md#javaArgs), [cph-ng.compilation.javaRunner](../configuration/compilation.md#javaRunner), [cph-ng.compilation.javaRunArgs](../configuration/compilation.md#javaRunArgs)

## 存储 { #storage }

编译设置存储在题目的 `problem.cph-ng.json` 文件的 `compilationSettings` 字段中。您也可以通过「编辑原始数据」选项直接编辑此文件。

## 错误处理 { #error-handling }

- 如果指定的编译器不存在或无法执行，将显示编译错误
- 无效的编译参数将导致编译失败，并在编译消息中显示错误详情

## 相关功能 { #relatives }

- [编辑题目](edit-problem.md)
- [运行所有测试用例](run-all-tests.md)
- [运行单个测试用例](run-single-test.md)

# 编译设置

!!! abstract
    控制 CPH-NG 如何编译源代码的设置，此页面下所有配置共有 `cph-ng.compilation.` 前缀。

## 基础编译部分 { #basic }

### `cCompiler` `cppCompiler` `javaCompiler` <small>字符串</small> { #compiler }

指定用于编译的 **编译器**。此设置决定了用于编译源代码的可执行文件。必须在系统 PATH 中可访问或提供完整路径。

| 语言 | 默认值 |
|:----:|:-----:|
| C    | `gcc` |
| C++  | `g++` |
| Java | `javac` |

### `cArgs` `cppArgs` `javaArgs` <small>字符串</small> { #args }

定义传递给编译器的**命令行参数**。有关编译器参数的更多信息，请查阅你的编译器文档。

| 语言 | 默认值                         |
|:----:|:----------------------------:|
| C    | `-O2 -std=c11 -Wall -DCPH`   |
| C++  | `-O2 -std=c++14 -Wall -DCPH` |
| Java | `-cp .`                      |

### `javaRunner` <small>字符串</small> { #runner }

指定用于执行已编译的程序或者源代码的 **运行时**。此设置决定了用于运行字节码或源码的可执行文件。

| 语言 | 默认值  |
|:----:|:------:|
| Java | `java` |

### `javaRunArgs` <small>字符串</small> { #runArgs }

定义在执行程序时传递给运行时的**命令行参数**。

| 语言 | 默认值  |
|:----:|:------:|
| Java | 空 |

### `timeout` <small>数字</small> { #timeout }

设置编译过程的最大允许时间（单位为**毫秒**），超时后将终止。设置为 `0` 可禁用超时，允许编译无限期运行。这可以防止进程挂起。

| 默认值 |
|:-:|
|`10000`|

### 相关功能 { #basic_relatives }

- [运行单个测试样例](../features/run-single-test.md)
- [运行所有测试样例](../features/run-all-tests.md)
- [特殊评测](../features/special-judge.md)
- [交互式题目](../features/interactive-problems.md)
- [暴力对拍](../features/stress-test.md)
- [缓存设置](cache.md)

## 高级编译部分 { #advanced }

!!! warning
    此栏的配置选项在 MacOS 无法执行，并且在 Windows/Linux 上的稳定性有待测试，故默认关闭。详情请参考 [包装脚本 / 运行器](../features/wrapper-runner.md)。

### `objcopy` <small>字符串</small> { #objcopy }

指定用于操作目标文件的 **objcopy** 工具。这通常用于高级构建过程中，例如提取节或转换格式。

| 默认值 |
|:-:|
|`objcopy`|

### `useWrapper` <small>布尔值</small> { #useWrapper }

**此选项仅适用于 C++ 程序。**启用后，程序将在一个包装脚本中执行，以提供更准确的时间测量。

| 默认值 |
|:-:|
|`false`|

### `useHook` <small>布尔值</small> { #useHook }

**仅在启用 [`useWrapper`](#useWrapper) 时可用。** 启用后，将编译并链接一个钩子与程序，以防止文件 IO。

| 默认值 |
|:-:|
|`false`|

### 相关功能 { #advanced_relatives }

- [包装脚本 / 运行器](../features/wrapper-runner.md)

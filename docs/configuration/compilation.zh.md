# 编译设置

控制 CPH-NG 如何为 C、C++ 和 Java 编译源代码的设置。

## 编译器路径

### `cph-ng.compilation.cPath`
- **类型**：字符串（可执行文件路径）
- **默认值**：`"gcc"`
- **用户影响**：指定要使用的 C 编译器。必须在系统 PATH 中可访问或提供完整路径。

### `cph-ng.compilation.cppPath`
- **类型**：字符串（可执行文件路径）
- **默认值**：`"g++"`
- **用户影响**：指定要使用的 C++ 编译器。

### `cph-ng.compilation.javaPath`
- **类型**：字符串（可执行文件路径）
- **默认值**：`"javac"`
- **用户影响**：指定要使用的 Java 编译器。

## 编译器参数

### `cph-ng.compilation.cArgs`
- **类型**：字符串
- **默认值**：`"-O2 -std=gnu11 -Wall"`
- **用户影响**：控制优化级别、语言标准和警告。

### `cph-ng.compilation.cppArgs`
- **类型**：字符串
- **默认值**：`"-O2 -std=gnu++20 -Wall"`
- **用户影响**：C++ 编译器的额外参数。

### `cph-ng.compilation.javaArgs`
- **类型**：字符串
- **默认值**：`""`
- **用户影响**：Java 编译器的额外参数。

## 编译超时

### `cph-ng.compilation.timeout`
- **类型**：数字
- **默认值**：`5000`（5 秒）
- **用户影响**：编译超过此时间终止。增加用于大项目。

## 磁盘操作

编译的二进制文件存储在：
- C/C++：临时缓存目录中的可执行文件
- Java：`.class` 文件在源文件旁边
- 使用缓存时，二进制文件在 `.cph-ng/cache/` 中

## 相关功能
- [运行单个测试](../features/run-single-test.md) - 在运行前编译
- [缓存设置](cache.md) - 加速编译

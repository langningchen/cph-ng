# Compilation Settings

Settings that control how CPH-NG compiles your source code for C, C++, and Java.

## Compiler Paths

### `cph-ng.compilation.cPath`

Path to the C compiler executable.

- **Type**: String (executable path)
- **Default**: `"gcc"`
- **User Impact**: Specifies which C compiler to use. Must be accessible in your system PATH or provide full path.

**Example**:
```json
{
  "cph-ng.compilation.cPath": "/usr/bin/clang"
}
```

### `cph-ng.compilation.cppPath`

Path to the C++ compiler executable.

- **Type**: String (executable path)
- **Default**: `"g++"`
- **User Impact**: Specifies which C++ compiler to use. Must be accessible in your system PATH or provide full path.

**Example**:
```json
{
  "cph-ng.compilation.cppPath": "/usr/bin/clang++"
}
```

### `cph-ng.compilation.javaPath`

Path to the Java compiler executable.

- **Type**: String (executable path)
- **Default**: `"javac"`
- **User Impact**: Specifies which Java compiler to use. Must be accessible in your system PATH or provide full path.

**Example**:
```json
{
  "cph-ng.compilation.javaPath": "/usr/lib/jvm/java-17/bin/javac"
}
```

## Compiler Arguments

### `cph-ng.compilation.cArgs`

Additional arguments passed to the C compiler.

- **Type**: String
- **Default**: `"-O2 -std=gnu11 -Wall"`
- **User Impact**: Controls optimization level, language standard, and warnings. Common use cases:
  - Optimization: `-O0` (debug), `-O2` (standard), `-O3` (aggressive)
  - Standards: `-std=c11`, `-std=c17`, `-std=gnu11`
  - Warnings: `-Wall`, `-Wextra`, `-Werror`
  - Debugging: `-g`
  - Sanitizers: `-fsanitize=address`, `-fsanitize=undefined`

**Examples**:

```json
{
  "cph-ng.compilation.cArgs": "-O3 -std=c17 -Wall -Wextra"
}
```

*Use C17 standard with aggressive optimization and extra warnings.*

```json
{
  "cph-ng.compilation.cArgs": "-g -O0 -std=c11 -Wall -fsanitize=address"
}
```

*Debug configuration with address sanitizer to catch memory errors.*

### `cph-ng.compilation.cppArgs`

Additional arguments passed to the C++ compiler.

- **Type**: String
- **Default**: `"-O2 -std=gnu++17 -Wall"`
- **User Impact**: Controls C++ compilation. Common use cases:
  - Standards: `-std=c++11`, `-std=c++14`, `-std=c++17`, `-std=c++20`, `-std=gnu++17`
  - Optimizations: Same as C
  - Debugging: `-g`, `-fsanitize=address`, `-fsanitize=undefined`
  - Platform: `-m32` (32-bit), `-m64` (64-bit)

**Examples**:

```json
{
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall"
}
```

*Use C++20 standard with O2 optimization for competitive programming.*

```json
{
  "cph-ng.compilation.cppArgs": "-g -O0 -std=c++17 -Wall -fsanitize=address,undefined"
}
```

*Debug with multiple sanitizers to catch memory and undefined behavior errors.*

### `cph-ng.compilation.javaArgs`

Additional arguments passed to the Java compiler.

- **Type**: String
- **Default**: `"-encoding UTF-8"`
- **User Impact**: Controls Java compilation options.

**Example**:
```json
{
  "cph-ng.compilation.javaArgs": "-encoding UTF-8 -Xlint:all"
}
```

*Enable all compiler warnings.*

## Compilation Timeout

### `cph-ng.compilation.timeout`

Maximum time allowed for compilation (in milliseconds).

- **Type**: Number
- **Default**: `3000` (3 seconds)
- **User Impact**: If compilation takes longer than this, it will be terminated. Increase if you have large projects or slower systems.

**Example**:
```json
{
  "cph-ng.compilation.timeout": 10000
}
```

*Allow up to 10 seconds for compilation.*

## Advanced Options

### `cph-ng.compilation.wrapper`

Command wrapper that executes before the compiler.

- **Type**: String
- **Default**: `""` (empty)
- **User Impact**: Runs before compilation. Use cases:
  - Environment setup
  - Custom build scripts
  - Compiler selection based on conditions

**Example**:
```json
{
  "cph-ng.compilation.wrapper": "ccache"
}
```

*Use ccache to speed up recompilation.*

### `cph-ng.compilation.beforeCompileHook`

Command executed before compilation starts.

- **Type**: String
- **Default**: `""` (empty)
- **User Impact**: Runs as a separate command before compilation. Use cases:
  - Pre-processing source files
  - Generating code
  - Checking dependencies

### `cph-ng.compilation.afterCompileHook`

Command executed after compilation completes.

- **Type**: String
- **Default**: `""` (empty)
- **User Impact**: Runs after successful compilation. Use cases:
  - Post-processing binaries
  - Running static analyzers
  - Copying output files

## Related Features

- [Run Single Test](../features/run-single-test.md) - Compiles before running
- [Run All Tests](../features/run-all-tests.md) - Compiles once for all tests
- [Cache Settings](cache.md) - Affects compilation speed through caching

# Configuration Reference

This page provides a complete reference for all CPH-NG configuration options. All settings can be configured through VS Code's Settings UI or by editing `settings.json`.

## Quick Navigation

- [Basic Settings](#basic-settings)
- [Compilation Settings](#compilation-settings)
- [Runner Settings](#runner-settings)
- [Comparing Settings](#comparing-settings)
- [Brute Force Compare Settings](#brute-force-compare-settings)
- [Problem Settings](#problem-settings)
- [Cache Settings](#cache-settings)
- [CPH Compatibility Settings](#cph-compatibility-settings)
- [Competitive Companion Settings](#competitive-companion-settings)
- [Sidebar Settings](#sidebar-settings)

---

## Basic Settings

Settings that control basic extension behavior.

### `cph-ng.basic.folderOpener`

**Type:** `string`  
**Default:** `"tree"`  
**Options:** `"tree"` | `"flat"`

Controls how folder selection dialogs are displayed when loading test cases from folders.

- **`tree`**: Uses VS Code's native tree-based folder picker (recommended)
- **`flat`**: Uses a flat list-based folder picker

**Example:**

```json
{
  "cph-ng.basic.folderOpener": "tree"
}
```

**When to change:**

- Use `"flat"` if you have issues with the tree picker on certain platforms
- Use `"tree"` for better navigation of nested folder structures

---

## Compilation Settings

Settings that control how your code is compiled.

### `cph-ng.compilation.cCompiler`

**Type:** `string`  
**Default:** `"gcc"`

The C compiler executable to use for compiling C source files.

**Example:**

```json
{
  "cph-ng.compilation.cCompiler": "gcc"
}
```

**Common alternatives:**

- `"clang"` - Use Clang instead of GCC
- `"/usr/bin/gcc-11"` - Use a specific GCC version

### `cph-ng.compilation.cArgs`

**Type:** `string`  
**Default:** `"-O2 -std=c11 -Wall -DCPH"`

Compiler flags to use when compiling C source files.

**Default flags explained:**

- `-O2`: Level 2 optimization
- `-std=c11`: Use C11 standard
- `-Wall`: Enable all warnings
- `-DCPH`: Define CPH macro (useful for conditional compilation)

**Example:**

```json
{
  "cph-ng.compilation.cArgs": "-O2 -std=c17 -Wall -Wextra -DCPH -fsanitize=address"
}
```

### `cph-ng.compilation.cppCompiler`

**Type:** `string`  
**Default:** `"g++"`

The C++ compiler executable to use for compiling C++ source files.

**Example:**

```json
{
  "cph-ng.compilation.cppCompiler": "g++"
}
```

**Common alternatives:**

- `"clang++"` - Use Clang instead of GCC
- `"/usr/bin/g++-11"` - Use a specific GCC version

### `cph-ng.compilation.cppArgs`

**Type:** `string`  
**Default:** `"-O2 -std=c++14 -Wall -DCPH"`

Compiler flags to use when compiling C++ source files.

**Default flags explained:**

- `-O2`: Level 2 optimization
- `-std=c++14`: Use C++14 standard
- `-Wall`: Enable all warnings
- `-DCPH`: Define CPH macro

**Example:**

```json
{
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall -Wextra -DCPH"
}
```

**Common customizations:**

- Change `-std=c++14` to `-std=c++17` or `-std=c++20` for newer standards
- Add `-fsanitize=address` for debugging memory issues
- Add `-fsanitize=undefined` for catching undefined behavior
- Add `-g` for debugging symbols
- Add `-static` for static linking

### `cph-ng.compilation.javaCompiler`

**Type:** `string`  
**Default:** `"javac"`

The Java compiler executable to use for compiling Java source files.

**Example:**

```json
{
  "cph-ng.compilation.javaCompiler": "javac"
}
```

### `cph-ng.compilation.javaArgs`

**Type:** `string`  
**Default:** `"-cp ."`

Compiler flags to use when compiling Java source files.

**Default flags explained:**

- `-cp .`: Set classpath to current directory

**Example:**

```json
{
  "cph-ng.compilation.javaArgs": "-cp . -encoding UTF-8"
}
```

### `cph-ng.compilation.javaRunner`

**Type:** `string`  
**Default:** `"java"`

The Java runtime executable to use for running Java programs.

**Example:**

```json
{
  "cph-ng.compilation.javaRunner": "java"
}
```

### `cph-ng.compilation.javaRunArgs`

**Type:** `string`  
**Default:** `""`

Arguments to pass to the Java runtime when executing Java programs.

**Example:**

```json
{
  "cph-ng.compilation.javaRunArgs": "-Xmx512m"
}
```

### `cph-ng.compilation.objcopy`

**Type:** `string`  
**Default:** `"objcopy"`

The objcopy utility path, used for stripping debug symbols from compiled binaries.

**Example:**

```json
{
  "cph-ng.compilation.objcopy": "objcopy"
}
```

**When to change:**

- Use a specific path if objcopy is not in your PATH
- Use a cross-platform objcopy if compiling for different architectures

### `cph-ng.compilation.timeout`

**Type:** `number`  
**Default:** `10000`  
**Unit:** milliseconds

Maximum time allowed for compilation. If compilation takes longer than this, it will be terminated.

**Example:**

```json
{
  "cph-ng.compilation.timeout": 15000
}
```

**When to change:**

- Increase for large projects that take longer to compile
- Decrease if you want faster feedback on compilation errors

### `cph-ng.compilation.useWrapper`

**Type:** `boolean`  
**Default:** `false`

Enable wrapper mode for compilation. When enabled, the entire compilation command is passed through a custom wrapper script.

**Example:**

```json
{
  "cph-ng.compilation.useWrapper": true
}
```

**Use cases:**

- Custom preprocessing of source files
- Adding extra compilation steps
- Integrating with build systems

### `cph-ng.compilation.useHook`

**Type:** `string`  
**Default:** `false`

Path to a hook script that runs before/after compilation.

**Example:**

```json
{
  "cph-ng.compilation.useHook": "/path/to/hook.sh"
}
```

**Use cases:**

- Copying resource files
- Running code generators
- Custom validation

---

## Runner Settings

Settings that control how your programs are executed.

### `cph-ng.runner.timeAddition`

**Type:** `number`  
**Default:** `1000`  
**Unit:** milliseconds

Additional time added to the problem's time limit when executing. This accounts for system overhead and ensures legitimate solutions aren't penalized.

**Example:**

```json
{
  "cph-ng.runner.timeAddition": 1000
}
```

**When to change:**

- Increase on slower machines
- Decrease on fast machines if you want stricter timing

### `cph-ng.runner.stdoutThreshold`

**Type:** `number`  
**Default:** `1000`  
**Unit:** bytes

Maximum size of stdout to display inline. If output exceeds this, it will be automatically saved to a file.

**Example:**

```json
{
  "cph-ng.runner.stdoutThreshold": 2000
}
```

**When to change:**

- Increase if you want to see more output inline
- Decrease if you want to save memory with large outputs

### `cph-ng.runner.stderrThreshold`

**Type:** `number`  
**Default:** `1000`  
**Unit:** bytes

Maximum size of stderr to display inline. If error output exceeds this, it will be automatically saved to a file.

**Example:**

```json
{
  "cph-ng.runner.stderrThreshold": 1500
}
```

### `cph-ng.runner.useRunner`

**Type:** `boolean`  
**Default:** `false`

Enable the advanced runner system for more accurate memory measurement and resource control.

**Example:**

```json
{
  "cph-ng.runner.useRunner": true
}
```

**Benefits when enabled:**

- More accurate memory usage measurement
- Better resource limit enforcement
- More precise timing

**Note:** May require additional system permissions on some platforms.

---

## Comparing Settings

Settings that control how outputs are compared with expected answers.

### `cph-ng.comparing.oleSize`

**Type:** `number`  
**Default:** `3`  
**Unit:** MB

The output size threshold for Output Limit Exceeded (OLE) status. If output exceeds this size, the test case will be marked as OLE.

**Example:**

```json
{
  "cph-ng.comparing.oleSize": 5
}
```

**When to change:**

- Increase if problems legitimately require large output
- Decrease to catch infinite loops earlier

### `cph-ng.comparing.regardPEAsAC`

**Type:** `boolean`  
**Default:** `false`

When enabled, Presentation Error (PE) is treated as Accepted (AC). PE occurs when output content is correct but formatting differs (e.g., extra whitespace).

**Example:**

```json
{
  "cph-ng.comparing.regardPEAsAC": true
}
```

**When to enable:**

- When you want to ignore formatting issues
- For problems where exact formatting doesn't matter
- During initial testing phase

### `cph-ng.comparing.ignoreError`

**Type:** `boolean`  
**Default:** `true`

When enabled, stderr output is ignored when comparing results. Only stdout is compared with the expected answer.

**Example:**

```json
{
  "cph-ng.comparing.ignoreError": false
}
```

**When to disable:**

- When debugging programs that should not produce any stderr
- When you want to enforce clean output

---

## Brute Force Compare Settings

Settings specific to the brute force comparison feature.

### `cph-ng.bfCompare.generatorTimeLimit`

**Type:** `number`  
**Default:** `10`  
**Unit:** seconds

Time limit for the test case generator program. If the generator takes longer than this, it will be terminated.

**Example:**

```json
{
  "cph-ng.bfCompare.generatorTimeLimit": 5
}
```

### `cph-ng.bfCompare.bruteForceTimeLimit`

**Type:** `number`  
**Default:** `60`  
**Unit:** seconds

Time limit for the brute force reference solution. This can be longer than regular time limits since brute force solutions are typically slower.

**Example:**

```json
{
  "cph-ng.bfCompare.bruteForceTimeLimit": 120
}
```

**When to change:**

- Increase for problems where even brute force takes a long time
- Decrease if you want faster iteration during testing

---

## Problem Settings

Settings related to problem management and test cases.

### `cph-ng.problem.defaultTimeLimit`

**Type:** `number`  
**Default:** `1000`  
**Unit:** milliseconds

Default time limit for newly created problems when not specified by Competitive Companion.

**Example:**

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000
}
```

### `cph-ng.problem.defaultMemoryLimit`

**Type:** `number`  
**Default:** `512`  
**Unit:** MB

Default memory limit for newly created problems when not specified by Competitive Companion.

**Example:**

```json
{
  "cph-ng.problem.defaultMemoryLimit": 256
}
```

### `cph-ng.problem.foundMatchTestCaseBehavior`

**Type:** `string`  
**Default:** `"always"`  
**Options:** `"ask"` | `"always"` | `"never"`

Controls what happens when CPH-NG finds matching test case files in the workspace.

- **`ask`**: Prompt user whether to load the found test cases
- **`always`**: Automatically load found test cases without prompting
- **`never`**: Ignore found test cases

**Example:**

```json
{
  "cph-ng.problem.foundMatchTestCaseBehavior": "ask"
}
```

### `cph-ng.problem.templateFile`

**Type:** `string`  
**Default:** `""`

Path to a code template file that will be used as the starting point for new problems.

**Example:**

```json
{
  "cph-ng.problem.templateFile": "/home/user/templates/cpp_template.cpp"
}
```

**Template variables:**

Your template can include placeholders that CPH-NG will replace:

- Problem-specific placeholders (when available from Competitive Companion)

### `cph-ng.problem.problemFilePath`

**Type:** `string`  
**Default:** `"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`

Path pattern for storing problem data files (metadata and test cases).

**Available variables:**

- `${workspace}`: Workspace root directory
- `${relativeDirname}`: Directory of source file relative to workspace
- `${basename}`: Source filename without extension
- `${dirname}`: Full directory path of source file
- `${filename}`: Source filename with extension
- `${tmp}`: System temporary directory
- `${home}`: User home directory

**Example:**

```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.cph-ng/${basename}.bin"
}
```

### `cph-ng.problem.unzipFolder`

**Type:** `string`  
**Default:** `"${workspace}/.cph-ng/${zipBasenameNoExt}"`

Path pattern for extracting zip files containing test cases.

**Available variables:**

- `${workspace}`: Workspace root directory
- `${zipBasenameNoExt}`: Zip filename without extension
- `${tmp}`: System temporary directory
- `${home}`: User home directory

**Example:**

```json
{
  "cph-ng.problem.unzipFolder": "${tmp}/cph-testcases/${zipBasenameNoExt}"
}
```

### `cph-ng.problem.deleteAfterUnzip`

**Type:** `boolean`  
**Default:** `false`

When enabled, zip files are automatically deleted after extraction.

**Example:**

```json
{
  "cph-ng.problem.deleteAfterUnzip": true
}
```

### `cph-ng.problem.clearBeforeLoad`

**Type:** `boolean`  
**Default:** `true`

When enabled, existing test cases are cleared before loading new ones from files/folders.

**Example:**

```json
{
  "cph-ng.problem.clearBeforeLoad": false
}
```

**When to disable:**

- When you want to merge test cases from multiple sources
- When adding supplementary test cases to existing ones

### `cph-ng.problem.maxInlineDataLength`

**Type:** `number`  
**Default:** `65536`  
**Unit:** bytes

Maximum size for displaying test case data inline. Larger data is automatically stored in external files.

**Example:**

```json
{
  "cph-ng.problem.maxInlineDataLength": 32768
}
```

**When to change:**

- Decrease if you want to conserve memory
- Increase if you prefer inline display for larger test cases

---

## Cache Settings

Settings that control compilation and runtime caching.

### `cph-ng.cache.directory`

**Type:** `string`  
**Default:** `"${tmp}/cph-ng"`

Directory where CPH-NG stores compiled binaries and cache files.

**Available variables:**

- `${tmp}`: System temporary directory
- `${home}`: User home directory

**Example:**

```json
{
  "cph-ng.cache.directory": "${home}/.cache/cph-ng"
}
```

### `cph-ng.cache.cleanOnStartup`

**Type:** `boolean`  
**Default:** `true`

When enabled, the cache directory is cleaned when VS Code starts.

**Example:**

```json
{
  "cph-ng.cache.cleanOnStartup": false
}
```

**When to disable:**

- If you want to preserve compiled binaries across VS Code restarts
- If cache cleanup causes issues on your system

---

## CPH Compatibility Settings

Settings for compatibility with the original CPH extension.

### `cph-ng.cphCapable.enabled`

**Type:** `boolean`  
**Default:** `true`

Enable compatibility features for importing data from the original CPH extension.

**Example:**

```json
{
  "cph-ng.cphCapable.enabled": false
}
```

**When to disable:**

- If you're not migrating from CPH
- If compatibility features cause issues

---

## Competitive Companion Settings

Settings for integration with the Competitive Companion browser extension.

### `cph-ng.companion.listenPort`

**Type:** `number`  
**Default:** `27121`

Port number that CPH-NG listens on for problem data from Competitive Companion.

**Example:**

```json
{
  "cph-ng.companion.listenPort": 27121
}
```

**When to change:**

- If port 27121 is already in use by another application
- Make sure Competitive Companion is configured to send to the same port

### `cph-ng.companion.defaultExtension`

**Type:** `string`  
**Default:** `"cpp"`

Default file extension for source files created by Competitive Companion.

**Example:**

```json
{
  "cph-ng.companion.defaultExtension": "java"
}
```

**Common values:**

- `"cpp"` - C++
- `"c"` - C
- `"java"` - Java

### `cph-ng.companion.submitLanguage`

**Type:** `number`  
**Default:** `-1`  
**Options:** `-1` (prompt) | `54` (C++17) | `89` (C++20) | `91` (C++23)

Default language ID for submitting to Codeforces.

- **`-1`**: Prompt for language each time
- **`54`**: C++17 (GCC 64-bit)
- **`89`**: C++20 (GCC 64-bit)
- **`91`**: C++23 (GCC 64-bit)

**Example:**

```json
{
  "cph-ng.companion.submitLanguage": 89
}
```

### `cph-ng.companion.addTimestamp`

**Type:** `boolean`  
**Default:** `true`

When enabled, adds a timestamp to filenames to avoid conflicts when multiple problems are imported in quick succession.

**Example:**

```json
{
  "cph-ng.companion.addTimestamp": false
}
```

### `cph-ng.companion.chooseSaveFolder`

**Type:** `boolean`  
**Default:** `false`

When enabled, prompts for a save location each time a problem is imported from Competitive Companion.

**Example:**

```json
{
  "cph-ng.companion.chooseSaveFolder": true
}
```

### `cph-ng.companion.showPanel`

**Type:** `number`  
**Default:** `-1`

Controls when to show the CPH-NG panel after importing from Competitive Companion.

**Options:**

- **`-1`**: Always show
- **`-2`**: Never show
- **`1-9`**: Show in specific editor column

**Example:**

```json
{
  "cph-ng.companion.showPanel": -1
}
```

### `cph-ng.companion.shortCodeforcesName`

**Type:** `boolean`  
**Default:** `true`

Use shorter filenames for Codeforces problems (e.g., "A" instead of "A - Problem Title").

**Example:**

```json
{
  "cph-ng.companion.shortCodeforcesName": true
}
```

### `cph-ng.companion.shortLuoguName`

**Type:** `boolean`  
**Default:** `true`

Use shorter filenames for Luogu problems.

**Example:**

```json
{
  "cph-ng.companion.shortLuoguName": true
}
```

### `cph-ng.companion.shortAtCoderName`

**Type:** `boolean`  
**Default:** `true`

Use shorter filenames for AtCoder problems.

**Example:**

```json
{
  "cph-ng.companion.shortAtCoderName": true
}
```

---

## Sidebar Settings

Settings that control the CPH-NG sidebar panel appearance and behavior.

### `cph-ng.sidebar.retainWhenHidden`

**Type:** `boolean`  
**Default:** `true`

When enabled, the sidebar panel state is retained even when hidden. This prevents losing your work when switching between panels.

**Example:**

```json
{
  "cph-ng.sidebar.retainWhenHidden": false
}
```

### `cph-ng.sidebar.showAcGif`

**Type:** `boolean`  
**Default:** `true`

When enabled, displays a celebration GIF when all test cases pass (AC).

**Example:**

```json
{
  "cph-ng.sidebar.showAcGif": false
}
```

### `cph-ng.sidebar.colorTheme`

**Type:** `string`  
**Default:** `"auto"`  
**Options:** `"auto"` | `"light"` | `"dark"`

Controls the color theme of the sidebar panel.

- **`auto`**: Follow VS Code theme
- **`light`**: Always use light theme
- **`dark`**: Always use dark theme

**Example:**

```json
{
  "cph-ng.sidebar.colorTheme": "dark"
}
```

### `cph-ng.sidebar.hiddenStatuses`

**Type:** `array`  
**Default:** `[]`

Array of status codes to hide in the UI. Useful for decluttering when certain statuses are not relevant to you.

**Available status codes:**

- `UKE`, `AC`, `PC`, `PE`, `WA`, `TLE`, `MLE`, `OLE`, `RE`, `RF`
- `CE`, `SE`, `WT`, `FC`, `CP`, `CPD`, `JG`, `JGD`, `CMP`, `SK`, `RJ`

**Example:**

```json
{
  "cph-ng.sidebar.hiddenStatuses": ["WT", "FC", "CP", "CPD", "JG", "JGD", "CMP"]
}
```

### `cph-ng.sidebar.showTips`

**Type:** `boolean`  
**Default:** `true`

When enabled, displays helpful tips in the sidebar when no problem is loaded.

**Example:**

```json
{
  "cph-ng.sidebar.showTips": false
}
```

### `cph-ng.sidebar.fontFamily`

**Type:** `string`  
**Default:** `""`

Custom font family for the sidebar panel. Leave empty to use VS Code's default font.

**Example:**

```json
{
  "cph-ng.sidebar.fontFamily": "Fira Code, monospace"
}
```

---

## Configuration Examples

### Competitive Programming Setup

Optimized for Codeforces/AtCoder style contests:

```json
{
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall -DCPH",
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.companion.addTimestamp": true,
  "cph-ng.comparing.regardPEAsAC": false,
  "cph-ng.sidebar.showAcGif": true
}
```

### Debugging Setup

Configuration for debugging and development:

```json
{
  "cph-ng.compilation.cppArgs": "-O0 -std=c++20 -Wall -g -fsanitize=address -fsanitize=undefined -DCPH",
  "cph-ng.runner.useRunner": true,
  "cph-ng.comparing.ignoreError": false,
  "cph-ng.sidebar.hiddenStatuses": []
}
```

### Performance-Focused Setup

For fast iteration during contests:

```json
{
  "cph-ng.compilation.timeout": 5000,
  "cph-ng.cache.cleanOnStartup": false,
  "cph-ng.runner.timeAddition": 500,
  "cph-ng.problem.clearBeforeLoad": true
}
```

---

## Path Variables Reference

Many settings support path variables for flexibility:

| Variable | Description | Example |
|----------|-------------|---------|
| `${workspace}` | Current workspace root | `/home/user/projects/contest` |
| `${tmp}` | System temporary directory | `/tmp` |
| `${home}` | User home directory | `/home/user` |
| `${basename}` | Filename without extension | `problem_a` |
| `${filename}` | Filename with extension | `problem_a.cpp` |
| `${dirname}` | Full directory path | `/home/user/projects/contest` |
| `${relativeDirname}` | Directory relative to workspace | `contest1` |
| `${zipBasenameNoExt}` | Zip filename without extension | `testcases` |

---

## Getting Help

- If a setting is not working as expected, check the [FAQ](faq.md)
- For detailed feature information, see the [Feature Guide](features.md)
- Report issues on [GitHub](https://github.com/langningchen/cph-ng/issues)

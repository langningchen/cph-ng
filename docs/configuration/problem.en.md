# Problem Settings

Settings that control problem file management, default limits, and test case handling.

## Default Limits

### `cph-ng.problem.defaultTimeLimit`

Sets the default time limit for newly created problems.

- **Type**: Number (milliseconds)
- **Default**: `1000`
- **User Impact**: When you create a new problem, this value is automatically used as the time limit. Tests exceeding this limit will receive Time Limit Exceeded (TLE) verdict.

**Example**:
```json
{
  "cph-ng.problem.defaultTimeLimit": 2000
}
```

*New problems will have 2000ms (2 seconds) time limit.*

### `cph-ng.problem.defaultMemoryLimit`

Sets the default memory limit for newly created problems.

- **Type**: Number (megabytes)
- **Default**: `512`
- **User Impact**: When you create a new problem, this value is automatically used as the memory limit. Programs exceeding this limit may receive Memory Limit Exceeded (MLE) verdict (if runner is enabled).

**Example**:
```json
{
  "cph-ng.problem.defaultMemoryLimit": 256
}
```

*New problems will have 256MB memory limit.*

## File Paths

### `cph-ng.problem.problemFilePath`

Template pattern that determines where problem data files are stored on disk.

- **Type**: String (path template)
- **Default**: `"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`
- **User Impact**: Controls the folder structure where your problem data is saved. Changing this affects where you'll find your problem files in the file explorer.

**Path Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `${workspace}` | Your workspace root | `/home/user/project` |
| `${dirname}` | Full directory path | `/home/user/project/src` |
| `${relativeDirname}` | Directory relative to workspace | `src` |
| `${basename}` | Filename with extension | `main.cpp` |
| `${basenameNoExt}` | Filename without extension | `main` |
| `${extname}` | File extension | `.cpp` |

**Examples**:

```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.cph/${basenameNoExt}.bin"
}
```

*Stores all problems in a single `.cph` folder: `.cph/main.bin`, `.cph/problem2.bin`, etc.*

```json
{
  "cph-ng.problem.problemFilePath": "${dirname}/.cph-ng/${basename}.bin"
}
```

*Stores problems in `.cph-ng` folder next to source file.*

### `cph-ng.problem.binaryFilePath`

Template pattern for compiled binary output location.

- **Type**: String (path template)
- **Default**: `"${workspace}/.cph-ng/${relativeDirname}/${basenameNoExt}${extname}.o"`
- **User Impact**: Determines where compiled executables are stored. This affects disk space usage and cleanup.

## Template File

### `cph-ng.problem.templateFile`

Path to a template file used when creating new problem source files.

- **Type**: String (file path)
- **Default**: `""` (empty - no template)
- **User Impact**: If set, new problem source files will be initialized with content from this template file. Useful for including standard libraries, macros, or boilerplate code.

**Example**:
```json
{
  "cph-ng.problem.templateFile": "${workspace}/template.cpp"
}
```

*When creating a new problem, the source file will be initialized with content from `template.cpp`.*

## Test Case Loading

### `cph-ng.problem.clearBeforeLoadTestCases`

Controls whether existing test cases are cleared when loading new ones from files.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**: 
  - `false`: New test cases are added to existing ones
  - `true`: All existing test cases are deleted before loading new ones

**Example**:
```json
{
  "cph-ng.problem.clearBeforeLoadTestCases": true
}
```

*Loading test cases from a folder will replace all existing test cases instead of appending.*

### `cph-ng.problem.deleteAfterUnzip`

Controls whether zip files are automatically deleted after extracting test cases.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**: 
  - `true`: Zip file is deleted after extraction (saves disk space)
  - `false`: Zip file is kept (allows reloading from same file)

**Example**:
```json
{
  "cph-ng.problem.deleteAfterUnzip": true
}
```

*When loading test cases from a zip file, the zip is automatically deleted after extraction.*

## Related Features

- [Create Problem](../features/create-problem.md) - Uses default limits
- [Edit Problem](../features/edit-problem.md) - Modify limits after creation
- [Load Test Cases](../features/load-test-cases.md) - Uses test case loading settings

# CPH Compatibility Settings

Settings that control integration with the original CPH (Competitive Programming Helper) extension.

## Overview

CPH-NG can import problems created with the original CPH extension, allowing you to migrate existing problems or use both extensions in parallel.

## Compatibility Check

### `cph-ng.cphCapable.checkOnStartup`

Automatically check for CPH problems when opening files.

- **Type**: Boolean
- **Default**: `true`
- **User Impact**:
  - `true`: CPH-NG detects when you open a file with existing CPH data and offers to import it
  - `false`: No automatic detection; manual import only

**Example**:
```json
{
  "cph-ng.cphCapable.checkOnStartup": false
}
```

*Disable automatic CPH problem detection.*

### `cph-ng.cphCapable.checkInterval`

How often to check for CPH problems (in milliseconds).

- **Type**: Number
- **Default**: `5000` (5 seconds)
- **User Impact**: Controls the delay between checks when opening files. Lower values mean faster detection but slightly more resource usage.

**Example**:
```json
{
  "cph-ng.cphCapable.checkInterval": 10000
}
```

*Check for CPH problems every 10 seconds.*

## How CPH Compatibility Works

### Detection Process

1. **File Open**: When you open a source file (`.cpp`, `.c`, `.java`)
2. **CPH Check**: CPH-NG looks for `.cph/` folder in the workspace
3. **Problem Match**: Searches for matching problem file (`.cph/.{filename}.prob`)
4. **Import Prompt**: If found and not already imported, shows import button

### Import Process

When you click the import button:

1. **Read CPH Data**: Reads problem metadata from `.cph/.{filename}.prob`
2. **Convert Format**: Transforms CPH format to CPH-NG format
3. **Create Problem**: Creates CPH-NG problem structure
4. **Save Data**: Writes to `.cph-ng/{filename}.bin`
5. **Preserve Original**: Original CPH `.prob` file remains unchanged

### File Structure

**Original CPH**:
```
workspace/
├── problem.cpp
└── .cph/
    └── .problem.cpp.prob  (CPH format - JSON)
```

**After CPH-NG Import**:
```
workspace/
├── problem.cpp
├── .cph/
│   └── .problem.cpp.prob  (Original CPH - preserved)
└── .cph-ng/
    └── problem.cpp.bin    (CPH-NG format - compressed)
```

### Data Migration

CPH-NG imports the following from CPH:

- ✅ Problem name
- ✅ Test cases (input and expected output)
- ✅ Time limit
- ✅ Memory limit
- ✅ Source file path
- ❌ Custom checkers (not supported in CPH)
- ❌ Interactive problems (not supported in CPH)

## When to Change These Settings

**Disable `checkOnStartup` when**:
- Not using original CPH extension
- Don't want automatic detection
- Performance concerns
- Want to manually control imports

**Increase `checkInterval` when**:
- Experiencing performance issues
- Don't need immediate detection
- Working with many files

**Keep Default Settings when**:
- Migrating from CPH to CPH-NG
- Using both extensions simultaneously
- Want seamless import experience

## Migration Workflow

### One-Time Migration

If migrating all problems from CPH to CPH-NG:

1. Keep `checkOnStartup: true`
2. Open each file with CPH problems
3. Click import button when prompted
4. After all imported, set `checkOnStartup: false` to disable checks

### Parallel Usage

If using both CPH and CPH-NG:

1. Keep `checkOnStartup: true`
2. CPH-NG will detect and import new CPH problems automatically
3. Both extensions can work on different problems
4. Each has its own data folder (`.cph` vs `.cph-ng`)

## Troubleshooting

### Import Button Not Showing

**Possible causes**:
- `checkOnStartup` is `false` → Enable it
- No `.cph/` folder in workspace → Verify CPH problems exist
- Problem already imported → Check `.cph-ng/` folder
- File not active → Make sure file is open in editor

**Solution**: 
- Enable `checkOnStartup`
- Use "CPH-NG: Import from CPH" command manually

### Import Fails

**Possible causes**:
- Corrupted `.prob` file
- Incompatible CPH version
- File permission issues

**Solution**:
- Check `.prob` file is valid JSON
- Manually create problem in CPH-NG
- Check file permissions

## Manual Import

You can always manually import using command palette:

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Type and select: `CPH-NG: Import from CPH`
3. Select problems to import

This works regardless of `checkOnStartup` setting.

## Related Features

- [CPH Import](../features/cph-import.md) - Detailed import process
- [Create Problem](../features/create-problem.md) - Alternative to importing
- [Import Problem](../features/import-problem.md) - Import from CPH-NG format

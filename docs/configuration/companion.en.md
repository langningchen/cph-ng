# Competitive Companion Settings

Settings for integration with the Competitive Companion browser extension.

## Overview

Competitive Companion is a browser extension that can automatically send problem information from online judges (Codeforces, AtCoder, etc.) directly to CPH-NG.

## Connection Settings

### `cph-ng.companion.listenPort`

Port number CPH-NG listens on for Competitive Companion connections.

- **Type**: Number
- **Default**: `10046`
- **User Impact**: This must match the port configured in your Competitive Companion browser extension. If you change this, update the extension settings too.

**Example**:
```json
{
  "cph-ng.companion.listenPort": 10050
}
```

*Change if port 10046 is already in use by another application.*

!!! warning "Port Conflicts"
    If another application uses this port, Competitive Companion won't work. Change to an available port (1024-65535).

## File Creation Settings

### `cph-ng.companion.defaultExtension`

Default file extension for problems imported from Competitive Companion.

- **Type**: String
- **Default**: `".cpp"`
- **User Impact**: When importing a problem, a new file with this extension is automatically created if it doesn't exist.

**Options**:
- `".cpp"` - C++
- `".c"` - C  
- `".java"` - Java

**Example**:
```json
{
  "cph-ng.companion.defaultExtension": ".java"
}
```

*Problems imported from browser will create `.java` files.*

### `cph-ng.companion.chooseSaveFolder`

Prompt for save location when importing problems.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**:
  - `false`: Problems saved to current workspace automatically
  - `true`: You're prompted to choose save location for each problem

**Example**:
```json
{
  "cph-ng.companion.chooseSaveFolder": true
}
```

*You'll be asked where to save each imported problem.*

### `cph-ng.companion.addTimestamp`

Add timestamp to filenames when importing problems.

- **Type**: Number (enum: 0, 1, 2)
- **Default**: `0`
- **Values**:
  - `0`: No timestamp
  - `1`: Add timestamp if file exists
  - `2`: Always add timestamp

- **User Impact**: Controls filename collision handling:
  - `0`: `A.cpp` (overwrites if exists)
  - `1`: `A.cpp` first time, `A-1234567890.cpp` if exists
  - `2`: `A-1234567890.cpp` always

**Example**:
```json
{
  "cph-ng.companion.addTimestamp": 1
}
```

*Adds timestamp only when filename conflicts occur.*

## Platform-Specific Naming

### `cph-ng.companion.shortCodeforcesName`

Use shorter names for Codeforces problems.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**:
  - `false`: Uses full names like `Codeforces Round 123 - Problem A - Title`
  - `true`: Uses short names like `A` or `123A`

**Example**:
```json
{
  "cph-ng.companion.shortCodeforcesName": true
}
```

*Imported Codeforces problems get short names: `A.cpp`, `B.cpp`, etc.*

### `cph-ng.companion.shortLuoguName`

Use shorter names for Luogu problems.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**: Similar to Codeforces, controls whether to use full problem titles or short identifiers.

**Example**:
```json
{
  "cph-ng.companion.shortLuoguName": true
}
```

### `cph-ng.companion.shortAtCoderName`

Use shorter names for AtCoder problems.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**: Similar to Codeforces, controls whether to use full problem titles or short identifiers.

**Example**:
```json
{
  "cph-ng.companion.shortAtCoderName": true
}
```

### `cph-ng.companion.showPanel`

Control visibility of problem source file when importing.

- **Type**: Number (enum: 0, 1, 2)
- **Default**: `2`
- **Values**:
  - `0`: Never show source file
  - `1`: Show only if file is new
  - `2`: Always show source file

- **User Impact**: Controls whether the imported source file opens in editor:
  - `0`: File created but not opened
  - `1`: Opens only newly created files
  - `2`: Always opens the file

**Example**:
```json
{
  "cph-ng.companion.showPanel": 0
}
```

*Files are created but not automatically opened in editor.*

## Submission Settings

### `cph-ng.companion.submitLanguage`

Default language ID for submissions to online judges.

- **Type**: Number
- **Default**: `54` (C++17 GCC)
- **User Impact**: When submitting to Codeforces or other judges, this language is selected by default. Language IDs vary by platform.

**Common Language IDs** (Codeforces):
- `43`: GNU G++17 7.3.0
- `54`: GNU G++17 9.2.0
- `73`: GNU G++20 11.2.0
- `87`: GNU G++20 13.2.0

**Example**:
```json
{
  "cph-ng.companion.submitLanguage": 73
}
```

*Use C++20 (GCC 11) for submissions.*

!!! tip "Finding Language IDs"
    Check the language dropdown on the judge's submission page to find the correct ID for your preferred language and compiler version.

## Typical Configurations

### Codeforces Competitive Setup
```json
{
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.companion.addTimestamp": 0,
  "cph-ng.companion.showPanel": 2,
  "cph-ng.companion.submitLanguage": 73
}
```

### Multi-Judge Setup
```json
{
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.companion.shortAtCoderName": true,
  "cph-ng.companion.shortLuoguName": true,
  "cph-ng.companion.chooseSaveFolder": true
}
```

## How It Works

When you click Competitive Companion in your browser:

1. **Extension Connects**: Browser extension connects to `localhost:10046` (or your configured port)
2. **Data Sent**: Problem metadata and test cases sent to CPH-NG
3. **File Created**: Source file created with `defaultExtension` in chosen/current location
4. **Naming Applied**: Filename determined by platform-specific naming settings
5. **Problem Initialized**: Problem structure created with received test cases
6. **Disk Operations**:
   - Source file written: `${workspace}/${problemName}.cpp`
   - Problem data written: `${workspace}/.cph-ng/${problemName}.cpp.bin`
7. **UI Update**: Problem panel shown based on `showPanel` setting

## Related Features

- [Competitive Companion](../features/competitive-companion.md) - How to use the integration
- [Import Problem](../features/import-problem.md) - Manual import alternative
- [Submit to Codeforces](../features/submit-codeforces.md) - Uses `submitLanguage` setting

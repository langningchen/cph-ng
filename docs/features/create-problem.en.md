# Create Problem

Create a new competitive programming problem in your workspace.

## Overview

The Create Problem feature initializes a new problem for the currently active source file. It creates the problem metadata structure and sets up default configuration based on your settings.

## UI Interaction

### Triggering the Feature

**Method 1: Sidebar Button**
- Open a source file (`.cpp`, `.c`, or `.java`)
- Click the `CREATE` button in the CPH-NG sidebar panel

**Method 2: Command Palette**
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Type and select: `CPH-NG: Create Problem`

**Method 3: Keyboard Shortcut**
- Press `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (macOS)

### Prerequisites

- An editor with a source file must be active
- The file must have a supported extension (`.cpp`, `.c`, `.java`)
- No problem should already exist for this file

### UI Components

The create problem view displays:
- Warning alert explaining the action
- `CREATE` button with send icon
- Optional `IMPORT` button if CPH data is detected

## Internal Operation

### How It Works

1. **Validation**
   - Checks if a source file path exists
   - Verifies no problem already exists for this file
   - Shows warning message if validation fails

2. **Problem Creation**
   - Creates a new problem object
   - Initializes with:
   - `version`: Current CPH-NG version
   - `name`: Filename without extension
   - `src.path`: Full path to source file
   - `tcs`: Empty array (no test cases initially)
   - `timeLimit`: From `cph-ng.problem.defaultTimeLimit`
   - `memoryLimit`: From `cph-ng.problem.defaultMemoryLimit`
   - `timeElapsed`: 0 (tracking time spent on problem)

3. **Storage**
   - Calculates binary file path using template pattern
   - Serializes problem data to JSON format
   - Compresses data with gzip
   - Writes to `.cph-ng/` folder in workspace

4. **UI Update**
   - Loads the new problem into active problems list
   - Updates sidebar with problem information
   - Refreshes the webview panel

### File System

**Problem Storage**:
- Default location: `${workspace}/.cph-ng/${relativeDirname}/${basename}.bin`
- Configurable via `cph-ng.problem.problemFilePath`

**File Format**:
- Gzip-compressed JSON
- Contains problem metadata and test cases
- Binary extension (.bin) to prevent accidental editing

### Message Flow

The UI sends a `createProblem` message to the extension, which then processes the request and creates the problem data structure.

## Configuration Options

This feature is affected by several settings that control problem creation behavior:

- **Time and Memory Limits**: Configure default limits for new problems  
  → See [Problem Settings](../configuration/problem.md#default-limits)

- **File Storage**: Choose where problem data files are stored  
  → See [Problem Settings](../configuration/problem.md#file-paths)

- **Templates**: Use a template file for initializing new problem source files  
  → See [Problem Settings](../configuration/problem.md#template-file)

## Error Handling

### Common Errors

**No Active Editor**
- **Cause**: No file is currently open
- **Message**: "No active editor found. Please open a file to create a problem."
- **Solution**: Open a source file and try again

**Problem Already Exists**
- **Cause**: Problem file already exists for this source file
- **Message**: "Problem already exists for this file"
- **Solution**: Delete existing problem first or use a different file

**Workspace Not Found**
- **Cause**: File is not in a workspace folder
- **Message**: Problem creation fails silently
- **Solution**: Open file in a workspace folder

### Implementation

Error handling is implemented in the problem creation module with appropriate user feedback for each error condition.

## Workflow Example

### Typical Usage

1. Open a new C++ file: `problem.cpp`
2. Click `CREATE` button in sidebar
3. CPH-NG creates:
   - Problem metadata with default limits
   - Empty test cases array
   - Binary file at `.cph-ng/problem.cpp.bin`
4. Sidebar updates to show problem panel
5. Ready to add test cases

### With Custom Settings

```json
{
  "cph-ng.problem.defaultTimeLimit": 3000,
  "cph-ng.problem.defaultMemoryLimit": 1024
}
```

Result: New problem created with 3000ms time limit and 1024MB memory limit.

## Related Features

- [Add Test Case](add-test-case.md) - Add test cases after creation
- [Edit Problem](edit-problem.md) - Modify problem metadata
- [Import Problem](import-problem.md) - Alternative creation method from CPH
- [Delete Problem](delete-problem.md) - Remove created problem

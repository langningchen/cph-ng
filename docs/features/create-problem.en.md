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

**Location**: `src/webview/components/createProblemView.tsx`

The create problem view displays:
- Warning alert explaining the action
- `CREATE` button (Material-UI Button with SendIcon)
- Optional `IMPORT` button if CPH data is detected

## Internal Operation

### Code Flow

**Entry Point**: `src/modules/cphNg.ts` - `createProblem(filePath?: string)`

1. **Validation** (`src/modules/cphNg.ts:28-44`)
   ```typescript
   - Check if filePath exists
   - Verify no problem already exists for this file
   - Show warning if validation fails
   ```

2. **Problem Creation** (`src/helpers/problems.ts:54-64`)
   ```typescript
   const problem = Problems.createProblem(filePath);
   ```
   Creates problem object with:
   - `version`: Current CPH-NG version
   - `name`: Filename without extension
   - `src.path`: Full path to source file
   - `tcs`: Empty array (no test cases initially)
   - `timeLimit`: From `cph-ng.problem.defaultTimeLimit`
   - `memoryLimit`: From `cph-ng.problem.defaultMemoryLimit`
   - `timeElapsed`: 0 (tracking time spent on problem)

3. **Storage** (`src/helpers/problems.ts` - `saveProblem`)
   - Calculates binary file path using template pattern
   - Serializes problem data to JSON
   - Compresses with gzip
   - Writes to `.cph-ng/` folder in workspace

4. **UI Refresh** (`src/modules/problemsManager.ts` - `dataRefresh`)
   - Loads the new problem into active problems list
   - Updates sidebar with problem information
   - Emits event to refresh webview

### File System

**Problem Storage Location**:
- Default: `${workspace}/.cph-ng/${relativeDirname}/${basename}.bin`
- Configurable via `cph-ng.problem.problemFilePath`

**File Format**:
- Gzip-compressed JSON
- Contains problem metadata and test cases
- Binary extension (.bin) to prevent accidental editing

### Message Flow

**WebView → Extension**:
```typescript
// src/webview/components/createProblemView.tsx:69-72
msg({ type: 'createProblem' })
```

**Extension Handler**:
```typescript
// src/modules/sidebarProvider.ts:102-103
if (msg.type === 'createProblem') {
    await CphNg.createProblem(msg.activePath);
}
```

## Configuration Options

### Related Settings

#### `cph-ng.problem.defaultTimeLimit`
- **Type**: `number`
- **Default**: `1000` (milliseconds)
- **Description**: Default time limit for newly created problems
- **Applied When**: Problem creation

#### `cph-ng.problem.defaultMemoryLimit`
- **Type**: `number`
- **Default**: `512` (MB)
- **Description**: Default memory limit for newly created problems  
- **Applied When**: Problem creation

#### `cph-ng.problem.problemFilePath`
- **Type**: `string`
- **Default**: `"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`
- **Description**: Template pattern for problem file storage location
- **Variables**:
  - `${workspace}`: Workspace root directory
  - `${dirname}`: Source file directory
  - `${relativeDirname}`: Directory relative to workspace
  - `${basename}`: Filename with extension
  - `${basenameNoExt}`: Filename without extension
  - `${extname}`: File extension
- **Applied When**: Problem file path calculation

#### `cph-ng.problem.templateFile`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Path to template file used when creating new problems
- **Applied When**: Initial source file creation (if file doesn't exist)

### Configuration Example

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.problem.defaultMemoryLimit": 256,
  "cph-ng.problem.problemFilePath": "${workspace}/.cph/${basenameNoExt}.bin"
}
```

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

Error handling code: `src/modules/cphNg.ts:28-44`

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

## Technical Details

### Dependencies

- `src/helpers/problems.ts` - Problem data management
- `src/modules/cphNg.ts` - Command implementation
- `src/modules/problemsManager.ts` - Problem lifecycle management
- `src/webview/components/createProblemView.tsx` - UI component

### Data Structure

```typescript
interface Problem {
    version: string;           // CPH-NG version
    name: string;              // Problem name (filename)
    src: { path: string };     // Source file path
    tcs: TC[];                 // Test cases array
    timeLimit: number;         // Time limit in ms
    memoryLimit: number;       // Memory limit in MB
    timeElapsed: number;       // Time spent (ms)
    url?: string;              // Optional problem URL
    checker?: SrcFile;         // Optional SPJ checker
    interactor?: SrcFile;      // Optional interactor
    bfCompare?: BFCompare;     // Optional BF compare config
}
```

### Source Code References

- Command registration: `src/modules/extensionManager.ts:200-206`
- WebView handler: `src/modules/sidebarProvider.ts:102-103`
- Problem creation: `src/modules/cphNg.ts:28-44`
- Data structure: `src/helpers/problems.ts:54-64`
- UI component: `src/webview/components/createProblemView.tsx:65-74`

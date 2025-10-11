# Load Test Cases

Import test cases from zip files or folders.

## Overview

The Load Test Cases feature allows you to import multiple test cases at once from external sources. It supports loading from zip archives or directory folders, automatically matching input (.in) files with answer (.out, .ans) files.

## UI Interaction

### Triggering the Feature

**Method: Sidebar Button**
- Click the folder/file copy icon button in the problem actions panel  
- Located as second button from left below problem title

### UI Components

**Location**: `src/webview/components/problemActions.tsx:85-92`
- Icon: `FileCopyIcon`
- Label: `problemActions.loadTcs`

## Internal Operation

### Code Flow

**Entry Point**: `src/modules/problemsManager.ts:173-187` - `loadTcs(msg: LoadTcsMsg)`

**Process**:
1. Shows quick pick dialog: "Load from zip file" or "Load from folder"
2. For zip: prompts for file, extracts to temporary folder
3. For folder: prompts for folder selection
4. Scans all files recursively
5. Matches `.in` files with `.out`/`.ans` files by basename
6. Shows selection dialog with found test cases
7. Imports selected cases to problem

**Implementation** (`src/utils/ui.ts:41-`):
- Uses `getTcs()` function for file scanning
- Supports recursive directory traversal
- Natural ordering of test cases

## Configuration Options

### Related Settings

#### `cph-ng.problem.unzipFolder`
- **Type**: `string`  
- **Default**: `"${workspace}/.cph-ng/${zipBasenameNoExt}"`
- **Description**: Template for zip extraction folder
- **Variables**: `${workspace}`, `${dirname}`, `${zipBasenameNoExt}`

#### `cph-ng.problem.deleteAfterUnzip`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Delete zip file after extraction

#### `cph-ng.problem.clearBeforeLoad`  
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Clear existing test cases before loading new ones

#### `cph-ng.basic.folderOpener`
- **Type**: `string`
- **Default**: `"tree"`  
- **Options**: `"tree"` | `"flat"`
- **Description**: Method for folder selection dialog

## Workflow Example

### Loading from Zip

1. Click load test cases button
2. Select "Load from a zip file"
3. Choose zip file from file system
4. Zip extracts to `.cph-ng/{zipname}/`
5. Found test cases are displayed
6. Select which ones to import
7. Test cases added to problem

### Loading from Folder

1. Click load test cases button
2. Select "Load from a folder"
3. Choose folder with test files
4. Files scanned for `.in`/`.out` pairs
5. Matching pairs shown in selection dialog
6. Select test cases to import
7. Test cases added to problem

## Related Features

- [Add Test Case](add-test-case.md) - Manual single case addition
- [Edit Test Case](edit-test-case.md) - Modify imported cases  
- [Toggle File/Inline](toggle-file-inline.md) - Switch data storage mode

## Technical Details

### File Matching Logic

**Input Files**: `.in` extension
**Answer Files**: `.out` or `.ans` extension  
**Matching**: By basename (e.g., `test1.in` + `test1.out`)

### Dependencies

- `src/utils/ui.ts` - `getTcs()` function
- `src/modules/problemsManager.ts` - `loadTcs()` handler
- `adm-zip` - Zip file extraction
- `src/helpers/folderChooser.ts` - Folder selection

### Source Code References

- Button UI: `src/webview/components/problemActions.tsx:85-92`
- Handler: `src/modules/problemsManager.ts:173-187`  
- File scanning: `src/utils/ui.ts:41-`
- Message type: `src/webview/msgs.ts:55-57`

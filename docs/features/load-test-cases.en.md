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

Button properties:
- Icon: File/folder icon
- Label: Localized "Load Test Cases" text
- Position: Second button from left in action panel

## Internal Operation

### How It Works

The load process follows these steps:

1. **Source Selection**: Shows dialog with options:
   - Load from a zip file
   - Load from a folder

2. **File/Folder Selection**:
   - For zip: Prompts user to choose a zip file
   - For folder: Prompts user to choose a directory
   - Zip files are extracted to a temporary folder

3. **Test Case Discovery**:
   - Scans all files recursively in the selected location
   - Matches `.in` files with corresponding `.out` or `.ans` files by name
   - Orders test cases naturally (test1, test2, test10, etc.)

4. **Test Case Selection**:
   - Displays all discovered test cases in a selection dialog
   - Shows input and answer file paths for each case
   - User can select which cases to import

5. **Import**:
   - Adds selected test cases to the problem
   - Optionally clears existing test cases first (based on settings)
   - Updates UI to show imported cases

## Configuration Options

This feature is affected by several settings:

- **Folder Selection**: Choose how folder picker works  
  → See [Basic Settings](../configuration/basic.md#folder-selection)

- **Zip Handling**: Control where zips extract and if they're deleted  
  → See [Problem Settings](../configuration/problem.md#test-case-loading)

- **Test Case Clearing**: Choose whether to keep or replace existing test cases  
  → See [Problem Settings](../configuration/problem.md#test-case-loading)

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

## File Matching Rules

CPH-NG matches input and answer files by their base names:

**Input Files**: Must have `.in` extension (e.g., `test1.in`, `sample01.in`)
**Answer Files**: Can have `.out` or `.ans` extension (e.g., `test1.out`, `sample01.ans`)
**Matching**: `test1.in` matches with `test1.out` or `test1.ans`

Files without matches are still imported (input only, no expected answer).

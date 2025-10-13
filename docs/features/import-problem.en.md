# Import Problem

Import a problem from the original CPH extension format.

## Overview

The Import Problem feature allows you to migrate problems from the original CPH (Competitive Programming Helper) extension to CPH-NG. It reads the CPH problem file associated with your source code and converts it to CPH-NG's format with all test cases and metadata.

## UI Interaction

### Triggering the Feature

**Method 1: Sidebar Button**
- Open a source file that has an associated CPH problem file
- Click the `IMPORT` button in the CPH-NG sidebar panel
- The button only appears when CPH problem data is detected

**Method 2: Command Palette**
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Type and select: `CPH-NG: Import Problem`

### Prerequisites

- A source file must be active in the editor
- A CPH problem file (`.prob`) must exist for that source file
- No CPH-NG problem should already exist for this file
- The CPH problem file must be in valid format

### UI Components

The import option appears as:
- An `IMPORT` button with input icon in the create problem view
- Only displayed when CPH data is detected for the current file
- Styled as a contained (filled) button to draw attention

## Internal Operation

### How It Works

1. **Detection**: Checks if a CPH problem file exists for the active source file
2. **Validation**: 
   - Verifies no CPH-NG problem already exists
   - Checks if source file path is valid
3. **Loading**: Reads and parses the CPH problem file
4. **Conversion**: Converts CPH data format to CPH-NG format:
   - Problem name and metadata
   - Time and memory limits
   - Test cases (input and expected output)
   - Problem URL if available
5. **Storage**: Saves converted problem in CPH-NG format
6. **UI Update**: Refreshes the sidebar to show the imported problem

### CPH File Location

CPH stores problem data in `.cph` folder with filenames based on the source file. CPH-NG automatically locates these files when checking for import availability.

## Configuration Options

### Related Settings

#### `cph-ng.problem.problemFilePath`
- **Type**: `string`
- **Default**: `"${workspace}/.cph-ng/${relativeDirname}/${basename}.bin"`
- **Description**: Where imported problems are stored in CPH-NG format
- **Note**: Imported problems are saved to this location after conversion

## Error Handling

### Common Errors

**No Active Editor**
- **Cause**: No file is currently open
- **Message**: "No active editor found. Please open a file to create a problem."
- **Solution**: Open a source file and try again

**Problem Already Exists**
- **Cause**: CPH-NG problem already exists for this file
- **Message**: "Problem already exists for this file"
- **Solution**: Delete existing CPH-NG problem first or use a different file

**No CPH Data Found**
- **Cause**: No CPH problem file exists for the source file
- **Message**: Import button is hidden
- **Solution**: Use Create Problem instead, or ensure CPH data exists

**Invalid CPH File**
- **Cause**: CPH file is corrupted or in wrong format
- **Message**: Import fails silently or shows error
- **Solution**: Check CPH file integrity or recreate from scratch

## Workflow Example

### Migrating from CPH

1. Open a file that has CPH problem data (e.g., `solution.cpp`)
2. CPH-NG detects the `.cph/solution.cpp.prob` file
3. The `IMPORT` button appears in the sidebar
4. Click `IMPORT` button
5. CPH-NG converts and imports:
   - Problem metadata
   - All test cases
   - Time/memory limits
6. Sidebar updates to show the imported problem
7. Test cases are immediately available for running

### After Import

- Original CPH file remains unchanged
- Problem is now in CPH-NG format
- Can use all CPH-NG features with imported problem
- Test cases maintain their data (input/output)

## Related Features

- [Create Problem](create-problem.md) - Alternative if no CPH data exists
- [Edit Problem](edit-problem.md) - Modify imported problem metadata
- [CPH Import](cph-import.md) - Batch import from CPH using command


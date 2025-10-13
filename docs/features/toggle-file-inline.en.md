# Toggle File/Inline

Switch test case data between file storage and inline display modes.

## Overview

The Toggle File/Inline feature allows you to change how test case data is stored and displayed. Small data can be shown inline for easy viewing and editing, while large data can be stored in external files for better performance.

## UI Interaction

### Triggering the Feature

**Method: Toggle Button**
- Expand a test case
- Locate the file/inline toggle icon (usually near input or answer fields)
- Click to switch between modes:
  - **Inline → File**: Saves data to external file
  - **File → Inline**: Loads data from file into inline editor

### Prerequisites

- A problem must be loaded
- Test case must exist
- For inline mode: Data size should be within limits

### UI Components

**Toggle Icons**:
- File icon: Indicates data is in file mode
- Inline icon: Indicates data is in inline mode
- Click to switch between modes

**Warning for Large Data**:
- If file data is very large, warning shown before converting to inline
- User can proceed or cancel

## Internal Operation

### How It Works

**Toggling to File Mode**:
1. User clicks toggle button on inline data
2. Data extracted from inline field
3. Unique filename generated
4. Data written to file
5. Test case updated to reference file
6. UI shows file icon with filename

**Toggling to Inline Mode**:
1. User clicks toggle button on file data
2. Check file size against limit
3. If too large, show warning
4. If user proceeds or size OK, read file
5. Load data into inline field
6. Test case updated to inline mode
7. UI shows editable text field

### File Naming

Files are named systematically:
- Input files: `input_{index}.txt` or similar
- Answer files: `answer_{index}.txt` or similar
- Stored in cache or problem-specific folder

## Configuration Options

### Size Limits

#### `cph-ng.problem.maxInlineDataLength`
- **Type**: `number`
- **Default**: `65536` (bytes)
- **Description**: Maximum size for inline data
- **Warning**: Attempting to inline larger data shows warning

#### `cph-ng.runner.stdoutThreshold`
- **Type**: `number`
- **Default**: `65536` (bytes)
- **Description**: Output size threshold (similar concept)

## When to Use Each Mode

### Use Inline Mode For:
- Small test inputs/outputs
- Frequently edited data
- Quick viewing and modification
- Test cases you want to see at a glance

### Use File Mode For:
- Large test data (> 64KB)
- Binary or special character data
- Performance optimization
- Data that rarely changes

## Workflow Example

### Converting Large Data to File

1. Test case has very long input inline
2. UI is slow or cluttered
3. Click toggle button
4. Data automatically saved to file
5. UI now shows just filename
6. Can still run tests normally

### Loading File Data for Quick Edit

1. Test case input is in file mode
2. Need to quickly edit a value
3. Click toggle button
4. If data not too large, loads inline
5. Edit directly in UI
6. Changes save to problem

### Handling Large File Warning

1. Click toggle on large file
2. Warning appears: "File is very large (800KB)"
3. Options: "Yes" to proceed or "Cancel"
4. If Yes: Data loads inline (may be slow)
5. If Cancel: Remains in file mode

## Related Features

- [Edit Test Case](edit-test-case.md) - Edit data in either mode
- [Load Test Cases](load-test-cases.md) - Imported data mode depends on size
- [Add Test Case](add-test-case.md) - New cases start in inline mode


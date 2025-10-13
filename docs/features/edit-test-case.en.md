# Edit Test Case

Modify test case input and expected answer data.

## Overview

The Edit Test Case feature allows you to modify the input data and expected answer for individual test cases. You can edit inline data or switch between inline and file storage modes.

## UI Interaction

### Triggering the Feature

**Method: Direct Editing**
- Expand a test case by clicking on it
- Click on input or answer fields to edit
- Type or paste your data
- Changes save automatically

### Prerequisites

- A problem must be loaded
- Test case must exist in the problem

### UI Components

Each test case displays:
- **Input Field**: Editable text area for test input
- **Answer Field**: Editable text area for expected output
- **Auto-save**: Changes are saved when you click away or modify content

## Internal Operation

### How It Works

1. **Expand Test Case**: User clicks on test case to expand it
2. **Edit Field**: User clicks on input or answer field
3. **Type Data**: User enters or modifies data
4. **Auto-save**: On blur or change, data is saved
5. **Update Problem**: Problem file is updated with new data
6. **Refresh UI**: Test case displays updated content

### Data Modes

**Inline Mode**:
- Data stored directly in problem file
- Suitable for small to medium sized data
- Easy to edit directly in UI

**File Mode**:
- Data stored in external files
- Better for large test data
- Files named systematically

## Configuration Options

### Data Size Limits

#### `cph-ng.problem.maxInlineDataLength`
- **Type**: `number`
- **Default**: `65536` (bytes)
- **Description**: Maximum size for inline data
- **Note**: Data exceeding this is automatically converted to file storage

## Editing Capabilities

### Text Input

- Paste from clipboard
- Type manually
- Multi-line support
- Preserves formatting and whitespace

### Large Data Handling

If data exceeds the inline limit:
- Automatically converted to file storage
- File icon shown instead of inline editor
- Can still view/edit through file

## Workflow Example

### Modifying Input Data

1. Locate test case in problem panel
2. Click to expand the test case
3. Click on "Input" section
4. Modify the input data:
   ```
   3 5
   1 2 3
   ```
5. Click elsewhere or press Tab
6. Changes are saved automatically

### Updating Expected Answer

1. Expand test case
2. Click on "Answer" section
3. Update expected output:
   ```
   8
   ```
4. Data saves automatically
5. Next test run will use new answer for comparison

### Correcting Wrong Answer

After running a test and seeing WA:
1. Review actual output
2. If expected answer was wrong, click on answer field
3. Update with correct expected output
4. Can also click "Set as Answer" button to use actual output

## Related Features

- [Add Test Case](add-test-case.md) - Create new test cases to edit
- [Toggle File/Inline](toggle-file-inline.md) - Switch storage mode
- [Compare Output](compare-output.md) - View differences when testing
- [Delete Test Case](delete-test-case.md) - Remove unwanted cases


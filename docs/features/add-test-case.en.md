# Add Test Case

Manually add a single test case to the current problem.

## Overview

The Add Test Case feature creates a new empty test case that can be filled with input data and expected answer. This is useful for creating custom test cases manually.

## UI Interaction

### Triggering the Feature

**Method: Sidebar Button**
- Click the plus icon (`+`) button in the problem actions panel
- Located as the leftmost button below the problem title

### Prerequisites

- A problem must be loaded for the current file
- The source file must be active in the editor

### UI Components

Button properties:
- Icon: Plus (+) icon
- Label: Localized "Add Test Case" text
- Size: Large button
- Position: First button in action panel (leftmost)

## Internal Operation

### How It Works

The extension performs these steps when adding a test case:

1. **Retrieve Problem**: Gets the current active problem
2. **Create Test Case**: Initializes a new empty test case object
3. **Add to Problem**: Appends the test case to the problem's test cases array
4. **Update UI**: Refreshes the interface to show the new test case

### Test Case Structure

New test case is initialized with:
- `stdin.useFile`: `false` (inline data mode)
- `stdin.data`: `''` (empty string)
- `answer.useFile`: `false` (inline data mode)  
- `answer.data`: `''` (empty string)
- `isExpand`: `false` (collapsed view)

### Message Flow

When the add test case button is clicked:
1. The webview sends an `addTc` message to the extension
2. The extension handler receives the message
3. The problem manager adds the new test case
4. The UI is updated to reflect the changes

## Configuration Options

### Related Settings

**No Direct Settings**

This feature does not have specific configuration options. However, test case behavior is affected by:

#### `cph-ng.problem.maxInlineDataLength`
- **Type**: `number`
- **Default**: `65536` (bytes)
- **Description**: Maximum size for inline data before auto-converting to file
- **Applied When**: Editing test case data

## Data Structure

```typescript
interface TC {
    stdin: TCIO;         // Input data
    answer: TCIO;        // Expected answer
    isExpand: boolean;   // UI expand state
    result?: TCResult;   // Execution result (added after running)
}

interface TCIO {
    useFile: boolean;    // true = file, false = inline
    data: string;        // inline data or file path
}
```

## Workflow Example

### Basic Usage

1. Open problem panel with existing problem
2. Click the `+` icon in actions panel
3. New test case appears collapsed at bottom of test cases list
4. Click to expand test case
5. Enter input data in "Input" field
6. Enter expected answer in "Answer" field
7. Data auto-saves on blur/change

### Multiple Test Cases

- No limit on number of test cases
- Each gets sequential index (#1, #2, #3, etc.)
- Can be reordered manually in the UI
- Can be deleted individually

## Related Features

- [Edit Test Case](edit-test-case.md) - Modify test case after creation
- [Load Test Cases](load-test-cases.md) - Bulk import from files
- [Delete Test Case](delete-test-case.md) - Remove test case
- [Run Single Test Case](run-single-test.md) - Execute the test

## Technical Details

### Implementation Notes

- Test cases are stored in the problem's test cases array
- The UI automatically displays newly added test cases
- Test cases can be edited immediately after creation
- No limit on the number of test cases that can be added

## Error Handling

### Silent Failures

If no problem is loaded (`fullProblem === null`), the function returns early without user notification. This is intentional to avoid spamming error messages when no problem exists.

### UI State

- Button is always visible when a problem is loaded
- Button click always succeeds if problem exists
- New test case immediately appears in UI after creation

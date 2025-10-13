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

This feature has no specific configuration settings. Test case data is stored according to:

- **Data Storage**: Control file vs inline storage modes  
  → See [Toggle File/Inline](toggle-file-inline.md) feature

- **Problem Data**: Where problem files are stored  
  → See [Problem Settings](../configuration/problem.md#file-paths)

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

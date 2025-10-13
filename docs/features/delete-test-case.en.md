# Delete Test Case

Remove a specific test case from the problem.

## Overview

The Delete Test Case feature allows you to remove individual test cases from a problem. This is useful for cleaning up unwanted or redundant test cases.

## UI Interaction

### Triggering the Feature

**Method: Delete Icon**
- Locate the test case you want to delete
- Hover over or click the test case to reveal controls
- Click the delete/trash icon for that specific test case
- No confirmation dialog - deletion is immediate

### Prerequisites

- A problem must be loaded
- At least one test case must exist

### UI Components

- Delete icon/button appears within each test case
- Usually positioned in the test case header or controls area
- Icon color typically indicates destructive action

## Internal Operation

### How It Works

1. **User Clicks Delete**: Delete icon clicked for specific test case
2. **Remove from Array**: Test case removed from problem's test cases array
3. **Update Indices**: Remaining test cases are re-indexed (#1, #2, etc.)
4. **Save**: Problem file updated without the deleted test case
5. **Refresh UI**: Test case list updates immediately

### What Gets Deleted

- Test case input data
- Expected answer data
- Test case execution results (if any)
- The test case entry in the problem

### What Is Preserved

- Other test cases remain unchanged
- Problem metadata unchanged
- Source code unchanged

## No Confirmation

Unlike problem deletion, test case deletion doesn't show a confirmation dialog. This allows quick cleanup of multiple test cases. Be careful when clicking delete icons.

## Workflow Example

### Removing Duplicate Test Case

1. Identify duplicate or unwanted test case
2. Locate its delete icon
3. Click delete icon
4. Test case immediately removed
5. Remaining test cases renumbered

### Cleaning Up After Import

After importing test cases from files:
1. Review all imported cases
2. Identify unnecessary ones
3. Delete each unwanted case
4. Keep only relevant test cases

## Related Features

- [Add Test Case](add-test-case.md) - Add new test cases
- [Load Test Cases](load-test-cases.md) - Import multiple cases
- [Edit Test Case](edit-test-case.md) - Modify instead of deleting


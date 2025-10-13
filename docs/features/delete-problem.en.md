# Delete Problem

Remove a problem and its data from the workspace.

## Overview

The Delete Problem feature permanently removes the problem associated with the current source file. This deletes the problem file containing metadata and test cases, but does not affect your source code file.

## UI Interaction

### Triggering the Feature

**Method: Delete Button**
- Click the delete/trash icon button (rightmost button in the problem actions panel)
- A confirmation dialog appears before deletion

### Prerequisites

- A problem must be loaded for the current file
- The problem panel must be visible

### UI Components

**Delete Button**:
- Icon: Trash/delete icon
- Color: Red (error color) to indicate destructive action
- Position: Rightmost button in actions panel

**Confirmation Dialog**:
- Title: Confirms deletion action
- Content: Warns that action cannot be undone
- Buttons: Cancel or Confirm

## Internal Operation

### How It Works

1. **User Clicks Delete**: Delete button is clicked
2. **Show Confirmation**: Modal dialog asks for confirmation
3. **User Confirms**: User clicks confirm button in dialog
4. **Delete File**: Problem binary file is deleted from filesystem
5. **Remove from Memory**: Problem is removed from active problems list
6. **Update UI**: Sidebar returns to "no problem" state
7. **Preserve Source**: Source code file remains untouched

### What Gets Deleted

- Problem metadata (name, URL, limits)
- All test cases (inputs and outputs)
- Problem configuration (SPJ, interactor settings)
- Execution history and timing data
- The `.cph-ng/*.bin` problem file

### What Is Preserved

- Source code file
- Compiled executables (in cache)
- Other problems in the workspace

## Safety Features

### Confirmation Required

Deletion requires explicit confirmation to prevent accidental data loss. The confirmation dialog clearly states that the action cannot be undone.

### Source Code Protected

Only the problem metadata file is deleted. Your source code remains safe and unchanged.

## Error Handling

### Deletion Failure

**File Not Found**:
- Problem file may have been already deleted
- Warning shown but operation continues

**Permission Error**:
- Insufficient permissions to delete file
- Error message displayed
- Problem remains in system

## Workflow Example

### Removing Old Problem

1. Open file with problem you want to delete
2. Problem panel shows in sidebar
3. Click red delete/trash icon (rightmost button)
4. Confirmation dialog appears: "Are you sure?"
5. Click "Confirm" to proceed or "Cancel" to abort
6. Problem is deleted
7. Sidebar shows "no problem" state
8. Source code file is unchanged

### After Deletion

- Can create a new problem for the same source file
- Can import CPH data if available
- All test runs and results are lost
- Need to set up test cases again if recreating

## Related Features

- [Create Problem](create-problem.md) - Create new problem after deletion
- [Import Problem](import-problem.md) - Import CPH data if available
- [Edit Problem](edit-problem.md) - Alternative to deletion for fixing problems


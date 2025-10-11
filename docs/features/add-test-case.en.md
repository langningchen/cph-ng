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

**Location**: `src/webview/components/problemActions.tsx:77-84`

Button properties:
- Icon: `AddIcon` (Material-UI)
- Label: Translated via `problemActions.addTc`
- Size: `larger={true}`
- Position: First button in action panel

## Internal Operation

### Code Flow

**Entry Point**: `src/modules/problemsManager.ts:161-172` - `addTc(msg: AddTcMsg)`

**Implementation**:
```typescript
public static async addTc(msg: msgs.AddTcMsg) {
    const fullProblem = await this.getFullProblem(msg.activePath);
    if (!fullProblem) {
        return;
    }
    fullProblem.problem.tcs.push({
        stdin: { useFile: false, data: '' },
        answer: { useFile: false, data: '' },
        isExpand: false,
    });
    await this.dataRefresh();
}
```

**Process**:
1. Retrieves the current problem from `fullProblems` list
2. Creates new test case object with empty data
3. Appends to problem's `tcs` array
4. Triggers UI refresh via `dataRefresh()`

### Test Case Structure

New test case is initialized with:
- `stdin.useFile`: `false` (inline data mode)
- `stdin.data`: `''` (empty string)
- `answer.useFile`: `false` (inline data mode)  
- `answer.data`: `''` (empty string)
- `isExpand`: `false` (collapsed view)

### Message Flow

**WebView → Extension**:
```typescript
// src/webview/components/problemActions.tsx:82
msg({ type: 'addTc' })
```

**Extension Handler**:
```typescript
// src/modules/sidebarProvider.ts (message handler)
if (msg.type === 'addTc') {
    await ProblemsManager.addTc(msg);
}
```

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

### Dependencies

- `src/modules/problemsManager.ts` - Test case management
- `src/webview/components/problemActions.tsx` - UI button
- `src/webview/components/tcView.tsx` - Test case display
- `src/utils/types.ts` - `TC` interface definition

### Source Code References

- Button UI: `src/webview/components/problemActions.tsx:77-84`
- Handler: `src/modules/problemsManager.ts:161-172`
- Message type: `src/webview/msgs.ts:52-54`
- Data structure: `src/utils/types.ts` (TC interface)

## Error Handling

### Silent Failures

If no problem is loaded (`fullProblem === null`), the function returns early without user notification. This is intentional to avoid spamming error messages when no problem exists.

### UI State

- Button is always visible when a problem is loaded
- Button click always succeeds if problem exists
- New test case immediately appears in UI after creation

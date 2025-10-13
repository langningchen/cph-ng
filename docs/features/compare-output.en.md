# Compare Output

View diff between actual output and expected answer for failed test cases.

## Overview

The Compare Output feature provides a visual diff viewer when a test case fails with Wrong Answer (WA). It highlights differences between your program's actual output and the expected answer, making it easy to identify discrepancies.

## UI Interaction

### Triggering the Feature

**Method: Compare Button**
- Run a test case that results in WA (Wrong Answer)
- A compare/diff icon button appears in the test case output area
- Click the button to open the comparison view

### Prerequisites

- Test case must have been run
- Test case result must be WA (Wrong Answer)
- Both actual output and expected answer must exist

### UI Components

**Compare Button**:
- Icon: Compare arrows or diff icon
- Position: In test case output area (leftmost button)
- Only visible for WA verdicts

**Comparison View**:
- Split view showing expected vs actual
- Differences highlighted in red and green
- Line-by-line comparison
- Side-by-side or unified diff format

## Internal Operation

### How It Works

1. **Test Fails**: Program produces output that doesn't match expected answer
2. **WA Verdict**: Comparator determines Wrong Answer
3. **Enable Compare**: Compare button becomes visible
4. **User Clicks**: Opens comparison modal/panel
5. **Diff Calculation**: System calculates differences between outputs
6. **Display**: Shows highlighted differences

### Comparison Algorithm

The feature performs:
- Line-by-line comparison
- Whitespace handling based on settings
- Character-level diff for changed lines
- Visual highlighting of additions/deletions

## Configuration Options

### Comparison Behavior

#### `cph-ng.comparing.regardPEAsAC`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Treat Presentation Error as Accepted
- **Effect**: If true, PE cases won't show as WA requiring comparison

#### `cph-ng.comparing.oleSize`
- **Type**: `number`
- **Default**: `3`
- **Description**: Maximum output lines difference for OLE (Output Limit Exceeded)
- **Effect**: Large output differences may show OLE instead of WA

#### `cph-ng.comparing.ignoreError`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Ignore stderr when comparing
- **Effect**: Comparison focuses only on stdout

## Comparison Features

### Visual Indicators

- **Red (Deleted)**: Lines in expected answer but not in actual output
- **Green (Added)**: Lines in actual output but not in expected answer
- **Highlighted Characters**: Specific character differences within lines

### Set as Answer

If you determine the expected answer was wrong:
- Can click "Set as Answer" button
- Updates expected answer to match actual output
- Useful for correcting test case answers

## Workflow Example

### Debugging Wrong Answer

1. Run test case
2. Result shows "WA"
3. Click compare button (diff icon)
4. Comparison view opens showing:
   ```
   Expected:  42
   Actual:    43
              ^^
   ```
5. Identify the difference
6. Return to code to fix the issue

### Fixing Expected Answer

1. Test case shows WA
2. Open comparison
3. Realize expected answer is incorrect
4. Click "Set as Answer" button
5. Expected answer updated to actual output
6. Re-run shows AC (Accepted)

### Handling PE (Presentation Error)

If `regardPEAsAC` is enabled and only whitespace differs:
1. Test case shows AC instead of WA
2. No comparison needed
3. Extra spaces/newlines ignored

## Related Features

- [Run Single Test](run-single-test.md) - Generate output to compare
- [Run All Tests](run-all-tests.md) - Multiple comparisons
- [Edit Test Case](edit-test-case.md) - Fix expected answers
- [Toggle File/Inline](toggle-file-inline.md) - For large outputs


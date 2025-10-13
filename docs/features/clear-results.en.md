# Clear Results

Reset test case execution results.

## Overview

The Clear Results feature removes execution results from test cases, returning them to an initial state. This is useful for cleaning up the UI or preparing for a fresh test run.

## UI Interaction

### Triggering the Feature

**Method 1: Clear All Results**
- Right-click in the problem actions area
- Select "Clear All Results" or similar option
- All test case results are cleared

**Method 2: Clear Single Result**
- Right-click on a specific test case
- Select "Clear Result" or "Clear Status"
- Only that test case's result is cleared

### Prerequisites

- Problem must be loaded
- Test cases must exist (with or without results)

### UI Components

**Clear Options**:
- Available via right-click context menus
- May also be available via menu button
- Applies to all tests or individual tests

## Internal Operation

### How It Works

**Clear All**:
1. User triggers clear all action
2. Each test case's result data is removed
3. Verdict reset to empty
4. Execution time/memory removed
5. Output data cleared (input/answer preserved)
6. UI refreshes to show clean state

**Clear Single**:
1. User triggers clear for specific test
2. Only that test's result data removed
3. Other tests unaffected
4. UI updates that test only

### What Gets Cleared

**Removed**:
- Verdict (AC, WA, TLE, etc.)
- Execution time
- Memory usage
- Actual output
- Error messages
- Comparison data

**Preserved**:
- Test input
- Expected answer
- Test case itself
- Source code

## When to Use

### Clean Slate

After many test runs, results accumulate:
- Clear all to start fresh
- Makes UI less cluttered
- Easier to see new results

### Before Important Run

Before submission or final validation:
1. Clear all results
2. Run all tests fresh
3. Verify clean pass

### After Code Changes

After significant changes:
- Old results may be confusing
- Clear them to avoid confusion
- Run tests with new code

## Workflow Example

### Cleaning Up

1. Have been running tests repeatedly
2. Some old WA results showing
3. Code now fixed
4. Right-click, select "Clear All Results"
5. All verdicts cleared
6. Run all tests fresh
7. See only new results

### Selective Clearing

1. Test cases #1-5 show old results
2. Test cases #6-10 show new results
3. Want to clear only old ones
4. Right-click test #1, clear result
5. Repeat for #2-5
6. Tests #6-10 keep their results

## Related Features

- [Run Single Test](run-single-test.md) - Generate new results
- [Run All Tests](run-all-tests.md) - Generate results for all
- [Stop Execution](stop-execution.md) - May leave partial results


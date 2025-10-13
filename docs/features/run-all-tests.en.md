# Run All Test Cases

Execute all test cases sequentially and display results.

## Overview

The Run All Test Cases feature executes your solution against every test case in sequence, displaying results for each. This is the primary way to validate your solution comprehensively before submission.

## UI Interaction

### Triggering the Feature

**Method 1: Run All Button**
- Click the run all/playlist icon in the problem actions panel
- All test cases execute in order

**Method 2: Keyboard Shortcut**
- Press the configured shortcut (check settings)
- All tests run immediately

**Method 3: Right-click Menu**
- Right-click on the run all button
- Choose compilation mode:
  - Force Compile
  - Skip Compile
  - Auto (default)

### Prerequisites

- Problem must be loaded
- Source file must be saved
- At least one test case must exist

### UI Components

**Run All Button**:
- Icon: Playlist play icon
- Color: Green (success color)
- Position: Third or fourth button in actions panel

**Progress Indicator**:
- Shows which test is currently running
- Updates as each test completes
- Can stop execution mid-run

## Internal Operation

### How It Works

1. **Pre-execution**:
   - Check if source file is saved
   - Determine if compilation needed
   - Compile once for all tests

2. **Sequential Execution**:
   - Run test #1, capture results
   - Run test #2, capture results
   - Continue for all tests
   - Each test independent

3. **Result Collection**:
   - Collect verdicts for all tests
   - Calculate total execution time
   - Track pass/fail count

4. **Display Summary**:
   - Update each test case with result
   - Show overall statistics
   - Highlight failures

### Execution Order

- Tests run in the order they appear
- Execution stops if user clicks stop
- Failed tests don't prevent subsequent tests
- Each test gets fresh execution environment

## Configuration Options

### Compilation

Same compilation settings as single test (see [Run Single Test](run-single-test.md)).

### Execution

#### `cph-ng.runner.timeAddition`
- Applied to each test case individually

#### `cph-ng.problem.timeLimit`
- Each test case uses the problem's time limit
- Tests don't share a time budget

## Stopping Execution

Two ways to stop:
1. **Stop All**: Click stop button (stops after current test)
2. **Stop Current Only**: Ctrl+Click stop button (skips to next test)

## Workflow Example

### Complete Validation

1. Write solution
2. Add/load all test cases
3. Click "Run All" button
4. Watch tests execute:
   - #1: AC (15ms)
   - #2: AC (23ms)
   - #3: WA (18ms)
   - #4: AC (31ms)
5. Fix issue causing #3 to fail
6. Run all again
7. All tests pass (AC)

### Quick Iteration

1. Make code change
2. Run all tests
3. Most pass, one TLE
4. Optimize algorithm
5. Run all again
6. All pass now

### Early Stopping

1. Run all tests
2. Test #2 fails
3. Don't want to wait for remaining 10 tests
4. Click stop button
5. Fix the issue
6. Run all again from start

## Result Summary

After running all tests:
- Total tests: 5
- Passed (AC): 4
- Failed (WA, TLE, etc.): 1
- Total time: 127ms
- Status: FAILED (if any test failed)

## Related Features

- [Run Single Test](run-single-test.md) - Test individual cases
- [Stop Execution](stop-execution.md) - Cancel running tests
- [Clear Results](clear-results.md) - Reset all results
- [Compare Output](compare-output.md) - Debug failures


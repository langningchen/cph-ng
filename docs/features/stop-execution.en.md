# Stop Execution

Terminate currently running test cases.

## Overview

The Stop Execution feature allows you to cancel test cases that are running. This is useful when a test takes too long, is stuck in an infinite loop, or when you realize you need to make changes before the tests finish.

## UI Interaction

### Triggering the Feature

**Method 1: Stop Button**
- While tests are running, the run button changes to a stop button
- Click to stop execution after current test completes

**Method 2: Stop Only Current (Ctrl+Click)**
- Ctrl+Click (or Cmd+Click on macOS) the stop button
- Stops the current test immediately
- Proceeds to next test case

### Prerequisites

- Tests must be currently running
- Stop button only appears during execution

### UI Components

**Stop Button**:
- Icon: Stop/square icon
- Color: Orange/warning color
- Replaces run button during execution
- Click: Stop after current test
- Ctrl+Click: Skip current test

## Internal Operation

### How It Works

**Normal Stop** (Click):
1. User clicks stop button
2. Current test continues to completion
3. After current test finishes, remaining tests cancelled
4. Results shown for completed tests
5. Incomplete tests show no result

**Skip Current** (Ctrl+Click):
1. User Ctrl+clicks stop button
2. Current test process is terminated immediately
3. Next test starts running
4. Useful for skipping stuck tests

### Process Termination

When stopping:
- Running process receives termination signal
- Process cleanup handled gracefully
- Temporary files cleaned up
- UI returns to ready state

## Workflow Example

### Stopping Infinite Loop

1. Run all tests
2. Test #3 runs forever (infinite loop)
3. Realize the bug
4. Click stop button
5. Test #3 eventually times out or click Ctrl+Click to skip
6. Fix code
7. Run again

### Quick Iteration During Development

1. Start running all 20 tests
2. After 5 tests, notice a pattern in failures
3. Don't want to wait for remaining 15 tests
4. Click stop
5. Current test finishes
6. Execution stops
7. Make fixes based on first 5 results

### Skipping Slow Test

1. Running all tests
2. Test #8 is very slow (legitimate, not a bug)
3. Want to skip it for now
4. Ctrl+Click stop when test #8 is running
5. Test #8 terminated
6. Test #9 starts immediately

## Related Features

- [Run Single Test](run-single-test.md) - Run one test at a time
- [Run All Tests](run-all-tests.md) - What stop interrupts
- [Clear Results](clear-results.md) - Clean up after stopping


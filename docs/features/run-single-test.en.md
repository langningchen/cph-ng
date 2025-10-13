# Run Single Test Case

Execute one test case and display results.

## Overview

The Run Single Test Case feature allows you to run your solution against a specific test case. This is useful for debugging individual cases or testing specific scenarios without running all test cases.

## UI Interaction

### Triggering the Feature

**Method 1: Run Button**
- Expand a test case
- Click the run/play icon for that specific test case
- Test executes immediately

**Method 2: Right-click Menu**
- Right-click on a test case
- Select run option from context menu
- Choose compilation mode (force compile or skip compile)

### Prerequisites

- A problem must be loaded
- Source file must be saved
- Test case must exist with at least input data

### UI Components

**Run Button**:
- Icon: Play/triangle icon
- Position: Within each test case
- Click to run that specific case

**Compilation Options** (via menu):
- Force Compile: Always recompile before running
- Skip Compile: Use cached binary if available
- Auto (Ctrl+Click): Smart compilation based on changes

## Internal Operation

### How It Works

1. **Compilation**:
   - Check if recompilation needed
   - Compile source if necessary (or forced)
   - Use cached binary if available and valid
   - Handle compilation errors

2. **Execution**:
   - Create temporary input file or pipe
   - Run compiled program with test input
   - Capture stdout, stderr
   - Measure execution time and memory
   - Apply time and memory limits
   - Handle timeouts and crashes

3. **Comparison**:
   - Compare actual output with expected answer
   - Determine verdict (AC, WA, TLE, MLE, RE, etc.)
   - Calculate differences if WA

4. **Display Results**:
   - Update test case UI with verdict
   - Show execution time and memory
   - Display output or error messages
   - Enable comparison if WA

### Verdict Types

- **AC** (Accepted): Output matches expected
- **WA** (Wrong Answer): Output differs from expected
- **TLE** (Time Limit Exceeded): Exceeded time limit
- **MLE** (Memory Limit Exceeded): Exceeded memory limit
- **RE** (Runtime Error): Program crashed
- **CE** (Compilation Error): Failed to compile
- **PE** (Presentation Error): Whitespace differences only
- **OLE** (Output Limit Exceeded): Output too large
- And others (see full list in comparing settings)

## Configuration Options

This feature is affected by multiple configuration settings:

- **Compilation**: Control compiler, arguments, and timeouts  
  → See [Compilation Settings](../configuration/compilation.md)

- **Execution**: Control resource measurement and time additions  
  → See [Runner Settings](../configuration/runner.md)

- **Comparison**: Control how output is compared and verdicts determined  
  → See [Comparing Settings](../configuration/comparing.md)

- **Caching**: Speed up repeated compilations  
  → See [Cache Settings](../configuration/cache.md)

## Workflow Example

### Basic Test Run

1. Write solution code
2. Save file
3. Expand test case #1
4. Click run button
5. See results:
   - ✅ #1 AC (15ms, 3.2MB)
6. Output matches expected answer

### Debugging TLE

1. Run test case
2. Result: TLE after 1000ms
3. Review code for infinite loops or inefficiency
4. Optimize algorithm
5. Re-run test case
6. Result: AC (250ms)

### Handling Compilation Error

1. Click run
2. Result: CE
3. Compilation output shows error
4. Fix syntax error in code
5. Save file
6. Re-run (automatically recompiles)

### Testing with Custom Input

1. Add new test case
2. Enter specific input to test edge case
3. Enter expected output (if known)
4. Run the test
5. Verify behavior

## Related Features

- [Run All Tests](run-all-tests.md) - Execute all test cases
- [Stop Execution](stop-execution.md) - Cancel running test
- [Clear Results](clear-results.md) - Reset test results
- [Compare Output](compare-output.md) - View differences for WA

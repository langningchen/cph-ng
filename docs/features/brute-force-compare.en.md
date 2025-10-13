# Brute Force Compare

Find edge cases automatically using generator, brute force, and optimized solution comparison.

## Overview

The Brute Force Compare feature helps discover edge cases and bugs by automatically generating test inputs, running both your optimized solution and a brute force reference solution, and comparing their outputs. When outputs differ, that test case is saved for debugging.

## UI Interaction

### Triggering the Feature

**Method: Brute Force Button**
- Click the brute force/compare arrows icon in the problem actions panel
- Dialog opens for configuration
- Start comparison process

### Prerequisites

- Problem must be loaded
- Three programs needed:
  - **Generator**: Creates random test inputs
  - **Brute Force**: Slow but correct solution
  - **Your Solution**: Fast solution to validate

### UI Components

**Brute Force Dialog**:
- Generator program selection
- Brute force solution selection
- Configuration options (iterations, limits)
- Start/Stop buttons
- Progress display
- Results summary

## Internal Operation

### How It Works

1. **Setup**:
   - User selects generator program
   - User selects brute force solution
   - Configures iteration limit

2. **Comparison Loop**:
   - Generator creates random input
   - Both solutions run with same input
   - Outputs are compared
   - If different, mismatch found
   - Loop continues until mismatch or limit reached

3. **Result Handling**:
   - If mismatch found:
     - Input saved as new test case
     - Both outputs saved
     - User notified
   - If all match:
     - "No differences found" message

4. **Test Case Creation**:
   - Failing input added to test cases
   - Expected answer from brute force
   - Can be debugged like normal test

### Generator Requirements

Generator program should:
- Output valid test input to stdout
- Generate random/varied inputs
- Run quickly (under time limit)
- Not require input itself

### Brute Force Requirements

Brute force solution should:
- Read input from stdin
- Output correct answer to stdout
- Be verified correct (even if slow)
- Handle same input format as main solution

## Configuration Options

This feature requires specific settings:

- **Time Limits**: Control how long generator and brute force can run  
  → See [Brute Force Settings](../configuration/brute-force.md)

- **Compilation**: Affects compilation of all three programs  
  → See [Compilation Settings](../configuration/compilation.md)

- **Runner**: Your main solution uses standard runner settings  
  → See [Runner Settings](../configuration/runner.md)

## Workflow Example

### Finding Edge Case

1. Write optimized solution (may have bug)
2. Write simple brute force solution (slow but correct)
3. Write generator (creates random inputs)
4. Open brute force dialog
5. Select generator program
6. Select brute force program
7. Set iteration limit (e.g., 1000)
8. Click "Start"
9. System runs comparison
10. After 347 iterations, finds mismatch
11. Test case auto-created with failing input
12. Debug using that test case

### Typical Generator Example (Python)

```python
import random
n = random.randint(1, 100)
print(n)
for i in range(n):
    print(random.randint(1, 1000))
```

### Typical Brute Force (Python)

```python
n = int(input())
arr = list(map(int, input().split()))
# Simple O(n²) solution
result = 0
for i in range(n):
    for j in range(i+1, n):
        if arr[i] > arr[j]:
            result += 1
print(result)
```

### When No Mismatch Found

1. Run 10000 iterations
2. All outputs match
3. High confidence solution is correct
4. Or generator not covering edge cases well

## Related Features

- [Run Single Test](run-single-test.md) - Test the found edge case
- [Add Test Case](add-test-case.md) - Manually add cases if needed
- [Special Judge](special-judge.md) - Alternative validation method


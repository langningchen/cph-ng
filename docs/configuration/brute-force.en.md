# Brute Force Compare Settings

Settings for the brute force comparison feature that automatically finds failing test cases.

## Overview

Brute force comparison helps you find edge cases by:
1. Running a generator to create random inputs
2. Running your solution on those inputs
3. Running a known-correct brute force solution
4. Comparing outputs to find discrepancies

## Time Limits

### `cph-ng.bfCompare.generatorTimeLimit`

Maximum time (in milliseconds) allowed for the test case generator to run.

- **Type**: Number
- **Default**: `3000` (3 seconds)
- **User Impact**: If the generator takes longer than this to produce a test case, it will be terminated. Increase if your generator needs more time for complex test cases.

**Example**:
```json
{
  "cph-ng.bfCompare.generatorTimeLimit": 5000
}
```

*Allow generator up to 5 seconds to create each test case.*

### `cph-ng.bfCompare.bruteForceTimeLimit`

Maximum time (in milliseconds) allowed for the brute force solution to run.

- **Type**: Number
- **Default**: `10000` (10 seconds)
- **User Impact**: If the brute force solution takes longer than this, it will be terminated. Brute force solutions are often slow, so this is typically higher than normal time limits.

**Example**:
```json
{
  "cph-ng.bfCompare.bruteForceTimeLimit": 30000
}
```

*Allow brute force solution up to 30 seconds per test case.*

## How It Works

1. **Generator Execution**: Creates a random test input (limited by `generatorTimeLimit`)
2. **Your Solution**: Runs on the generated input (uses problem's time limit)
3. **Brute Force Solution**: Runs on the same input (limited by `bruteForceTimeLimit`)
4. **Comparison**: Outputs are compared
5. **Result**:
   - If outputs match: Try another test case
   - If outputs differ: **Found failing case!** Saved for debugging

## Disk Operations

When a failing test case is found:

1. **Input Saved**: Generated input is saved to disk as a new test case
2. **Your Output**: Your solution's output is recorded
3. **Expected Output**: Brute force solution's output becomes the expected answer
4. **Problem Updated**: New test case is added to the problem file
5. **Files Updated**: Problem data file (`.cph-ng/*.bin`) is updated with the new test case

## When to Adjust These Settings

**Increase `generatorTimeLimit` when**:
- Generator creates complex structures (graphs, trees)
- Generator validates constraints
- Getting timeout errors during generation

**Increase `bruteForceTimeLimit` when**:
- Brute force solution has high complexity (O(n³), O(2ⁿ))
- Testing with large inputs
- Getting timeout on correct brute force solutions

**Decrease timeouts when**:
- Want faster iteration (test more cases per minute)
- Generator and brute force are very fast
- Working with small inputs

## Example Configuration

### For Simple Problems
```json
{
  "cph-ng.bfCompare.generatorTimeLimit": 1000,
  "cph-ng.bfCompare.bruteForceTimeLimit": 5000
}
```

### For Complex Problems
```json
{
  "cph-ng.bfCompare.generatorTimeLimit": 10000,
  "cph-ng.bfCompare.bruteForceTimeLimit": 60000
}
```

## Related Features

- [Brute Force Compare](../features/brute-force-compare.md) - Main feature documentation
- [Add Test Case](../features/add-test-case.md) - Where found cases are saved
- [Runner Settings](runner.md) - Your solution uses standard runner settings

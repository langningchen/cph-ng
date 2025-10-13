# Runner Settings

Settings that control program execution, resource measurement, and output handling.

## Runner Mode

### `cph-ng.runner.useRunner`

Enable advanced runner for accurate memory and resource measurement.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**:
  - `false`: Uses standard process execution (faster, but no memory measurement)
  - `true`: Uses advanced runner that can measure memory usage and provide more accurate resource tracking

**Example**:
```json
{
  "cph-ng.runner.useRunner": true
}
```

*Enables memory measurement and more accurate resource tracking.*

!!! note "Performance Note"
    Enabling the runner adds slight overhead but provides accurate memory measurement, which is useful for memory-limited problems.

## Time Adjustments

### `cph-ng.runner.timeAddition`

Additional time (in milliseconds) added to the time limit when running tests.

- **Type**: Number
- **Default**: `200`
- **User Impact**: Adds buffer time to account for process startup and system overhead. The program can run slightly longer than the problem's time limit without getting TLE.

**Example**:
```json
{
  "cph-ng.runner.timeAddition": 500
}
```

*Allows 500ms extra time for startup overhead.*

### `cph-ng.runner.stderrThreshold`

Maximum standard error output size (in bytes) before showing warning.

- **Type**: Number
- **Default**: `100000` (100KB)
- **User Impact**: If your program writes more than this to stderr, a warning is shown. Helps catch programs with excessive debug output.

**Example**:
```json
{
  "cph-ng.runner.stderrThreshold": 1000000
}
```

*Allow up to 1MB of stderr before warning.*

### `cph-ng.runner.stdoutThreshold`

Maximum standard output size (in bytes) before truncation.

- **Type**: Number
- **Default**: `100000` (100KB)
- **User Impact**: Output larger than this is truncated. Prevents memory issues from programs that print excessive output.

**Example**:
```json
{
  "cph-ng.runner.stdoutThreshold": 500000
}
```

*Allow up to 500KB of output.*

## When to Change These Settings

**Enable Runner When**:
- You need accurate memory measurement
- Working on memory-limited problems
- Debugging memory leaks

**Increase Time Addition When**:
- Running on slower systems
- Getting false TLE on startup
- Using sanitizers that add overhead

**Adjust Thresholds When**:
- Working with problems that produce large output
- Debugging programs with verbose logging
- Getting truncation warnings

## Related Features

- [Run Single Test](../features/run-single-test.md) - Uses these settings during execution
- [Run All Tests](../features/run-all-tests.md) - Applies settings to all test runs
- [Edit Problem](../features/edit-problem.md) - Set time/memory limits per problem

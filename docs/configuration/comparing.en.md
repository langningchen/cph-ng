# Comparing Settings

Settings that control how test outputs are compared against expected answers.

## Output Limit Exceeded

### `cph-ng.comparing.oleSize`

Threshold (in lines) for Output Limit Exceeded detection.

- **Type**: Number
- **Default**: `3`
- **User Impact**: If actual output has more than this many extra lines compared to expected answer, verdict becomes OLE (Output Limit Exceeded) instead of WA (Wrong Answer).

**Example**:
```json
{
  "cph-ng.comparing.oleSize": 5
}
```

*Output with 6+ extra lines gets OLE instead of WA.*

## Presentation Errors

### `cph-ng.comparing.regardPEAsAC`

Treat Presentation Error (trailing/leading whitespace differences) as Accepted.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**:
  - `false`: Extra whitespace at line ends or extra blank lines causes PE verdict
  - `true`: Whitespace differences are ignored, verdict becomes AC

**Example**:
```json
{
  "cph-ng.comparing.regardPEAsAC": true
}
```

*Trailing spaces and extra blank lines don't cause PE verdict.*

!!! tip "Competitive Programming"
    Most online judges are lenient with whitespace. Setting this to `true` matches typical judge behavior.

## Error Output Handling

### `cph-ng.comparing.ignoreError`

Controls whether stderr output is considered in verdict.

- **Type**: Boolean
- **Default**: `true`
- **User Impact**:
  - `true`: Programs can write to stderr without affecting verdict (common for debug output)
  - `false`: Any stderr output causes different verdict or warning

**Example**:
```json
{
  "cph-ng.comparing.ignoreError": false
}
```

*Programs writing to stderr will be flagged.*

!!! note "Debug Output"
    Keeping this `true` allows using `cerr` for debugging in C++ without affecting correctness checks.

## Comparison Behavior

The comparison process works as follows:

1. **Exact Match**: Output matches answer exactly → **AC** (Accepted)
2. **Whitespace Differences**: Trailing/leading spaces differ → **PE** (Presentation Error), or **AC** if `regardPEAsAC` is true
3. **Wrong Content**: Output content differs → **WA** (Wrong Answer)
4. **Too Much Output**: More than `oleSize` extra lines → **OLE** (Output Limit Exceeded)
5. **Runtime Error**: Program crashes or returns non-zero exit code → **RE** (Runtime Error)
6. **Time Limit**: Execution exceeds time limit → **TLE** (Time Limit Exceeded)
7. **Memory Limit**: Memory usage exceeds limit (if runner enabled) → **MLE** (Memory Limit Exceeded)

## When to Change These Settings

**Set `regardPEAsAC` to true**:
- Preparing for online judges that ignore whitespace
- Don't want to worry about output formatting
- Focus on algorithm correctness

**Set `regardPEAsAC` to false**:
- Need exact output format matching
- Testing output formatting requirements
- Preparing for strict formatting contests

**Set `ignoreError` to false**:
- Debugging programs that shouldn't write to stderr
- Want to catch all diagnostic output
- Testing code quality

**Adjust `oleSize`**:
- Getting incorrect OLE verdicts
- Want stricter or more lenient detection

## Related Features

- [Compare Output](../features/compare-output.md) - Visual diff for WA/PE cases
- [Run Single Test](../features/run-single-test.md) - Uses these comparison rules
- [Run All Tests](../features/run-all-tests.md) - Applies to all test comparisons
- [Special Judge](../features/special-judge.md) - Overrides standard comparison

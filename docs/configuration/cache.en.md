# Cache Settings

Settings that control compilation caching to speed up repeated compilations.

## Cache Directory

### `cph-ng.cache.cacheDirectory`

Location where compilation cache files are stored.

- **Type**: String (path template)
- **Default**: `"${tmp}/cph-ng"`
- **User Impact**: Determines where compiled binaries and cache data are stored on disk. Changing this affects:
  - Disk space usage location
  - Cache persistence across sessions
  - Multi-workspace cache sharing

**Path Variables**:

| Variable | Description |
|----------|-------------|
| `${tmp}` | System temporary directory |
| `${workspace}` | Workspace root directory |
| `${home}` | User home directory |

**Examples**:

```json
{
  "cph-ng.cache.cacheDirectory": "${workspace}/.cache/cph-ng"
}
```

*Stores cache in workspace (persists with project, not shared between projects).*

```json
{
  "cph-ng.cache.cacheDirectory": "${home}/.cache/cph-ng"
}
```

*Stores cache in home directory (shared between all projects, persists after closing VS Code).*

## Cache Cleanup

### `cph-ng.cache.cleanOnStartup`

Automatically clean cache directory when VS Code starts.

- **Type**: Boolean
- **Default**: `false`
- **User Impact**:
  - `false`: Cache persists between sessions (faster first compilation)
  - `true`: Cache is cleared on startup (ensures fresh compilation, uses more disk space temporarily)

**Example**:
```json
{
  "cph-ng.cache.cleanOnStartup": true
}
```

*Cache is cleared every time you start VS Code.*

## How Caching Works

### Compilation Cache

When you compile a program:

1. **Hash Calculation**: CPH-NG calculates a hash based on:
   - Source code content
   - Compiler path and arguments
   - Compilation settings
   
2. **Cache Check**: Looks for cached binary with matching hash

3. **Cache Hit**: If found, reuses compiled binary (skip compilation)

4. **Cache Miss**: Compiles and stores binary in cache with hash

5. **Cache Location**: Binary saved to `${cacheDirectory}/${hash}.o`

### Benefits

- **Faster Testing**: No recompilation when source hasn't changed
- **Quick Retries**: Rerunning same tests is instant
- **Lower CPU Usage**: Less compilation overhead

### Disk Usage

Each unique compilation creates a cached binary file:

- **Typical Size**: 100KB - 5MB per binary (depends on source code size and compilation flags)
- **Growth**: Cache grows as you work on different problems and make changes
- **Cleanup**: Automatically cleaned if `cleanOnStartup` is true, or manually delete the cache directory

## When to Change These Settings

**Change `cacheDirectory` when**:
- Want cache to persist with project (use `${workspace}/.cache`)
- Want cache shared globally (use `${home}/.cache`)
- Using remote development (use location accessible in remote environment)
- Need to control disk usage location

**Enable `cleanOnStartup` when**:
- Experiencing compilation issues
- Disk space is limited
- Want to ensure fresh compilation every session
- Debugging compilation problems

**Keep `cleanOnStartup` false when**:
- Want maximum performance
- Have plenty of disk space
- Frequently recompile same code

## Manual Cache Cleanup

You can manually clean the cache by deleting the cache directory:

**Linux/macOS**:
```bash
rm -rf /tmp/cph-ng
```

**Windows**:
```cmd
rd /s /q %TEMP%\cph-ng
```

Or use the location specified in your `cacheDirectory` setting.

## Related Features

- [Compilation Settings](compilation.md) - Compiler settings affect cache hash
- [Run Single Test](../features/run-single-test.md) - Benefits from caching
- [Run All Tests](../features/run-all-tests.md) - Only compiles once due to caching

# Configuration Reference

Complete reference for all CPH-NG configuration settings, organized by category.

## Setting Categories

CPH-NG provides 10 categories of settings to customize behavior:

### [Basic Settings](basic.md)
General extension behavior and UI preferences.

- `cph-ng.basic.folderOpener` - Folder selection method

### [Compilation Settings](compilation.md)  
Compiler configuration for C, C++, and Java.

- Compiler paths and arguments
- Compilation timeout
- Wrapper and hook support

### [Runner Settings](runner.md)
Program execution and resource measurement.

- Time additions and thresholds
- Output size limits
- Advanced runner for memory tracking

### [Comparing Settings](comparing.md)
Output comparison and verdict determination.

- Output limit exceeded threshold
- Presentation error handling
- Error output behavior

### [Brute Force Compare Settings](brute-force.md)
Settings for brute force comparison feature.

- Generator time limit
- Brute force solution timeout

### [Problem Settings](problem.md)
Problem file management and defaults.

- Default time and memory limits
- File path templates
- Template file location
- Test case loading behavior

### [Cache Settings](cache.md)
Compilation cache and temporary files.

- Cache directory location
- Cleanup behavior

### [CPH Compatibility Settings](cph-compat.md)
Integration with original CPH extension.

- Import compatibility options

### [Competitive Companion Settings](companion.md)
Browser extension integration settings.

- Listen port configuration
- File naming conventions
- Auto-import behavior
- Platform-specific options

### [Sidebar Settings](sidebar.md)
UI customization for the CPH-NG panel.

- Theme and colors
- Status display options
- Font customization
- Animation preferences

## Quick Reference

### Path Variables

Many settings support template variables for flexible path configuration:

| Variable | Description | Example |
|----------|-------------|---------|
| `${workspace}` | Workspace root | `/home/user/project` |
| `${tmp}` | System temp directory | `/tmp` |
| `${home}` | User home directory | `/home/user` |
| `${dirname}` | File directory | `/home/user/project/src` |
| `${relativeDirname}` | Relative directory | `src` |
| `${basename}` | Filename with extension | `main.cpp` |
| `${basenameNoExt}` | Filename without extension | `main` |
| `${extname}` | File extension | `.cpp` |

### Settings Access

**VS Code UI:**
1. Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (macOS)
2. Search for "cph-ng"
3. Browse and modify settings

**settings.json:**
```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall"
}
```

## Configuration Examples

### Competitive Programming Setup

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.problem.defaultMemoryLimit": 256,
  "cph-ng.compilation.cppArgs": "-O2 -std=c++17 -Wall",
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.comparing.regardPEAsAC": false
}
```

### Debug Configuration

```json
{
  "cph-ng.compilation.cppArgs": "-g -O0 -std=c++20 -Wall -fsanitize=address",
  "cph-ng.runner.useRunner": true,
  "cph-ng.comparing.ignoreError": false
}
```

### Performance Optimization

```json
{
  "cph-ng.cache.cleanOnStartup": false,
  "cph-ng.compilation.timeout": 5000,
  "cph-ng.runner.timeAddition": 500
}
```

## Source Code References

Settings are defined in: `src/modules/settings.ts`

Each setting category has a corresponding class:
- `BasicSection` (line 45)
- `CompilationSection` (line 54)  
- `RunnerSection` (line 158)
- `ComparingSection` (line 176)
- `BFCompareSection` (line 191)
- `ProblemSection` (line 203)
- `CacheSection` (line 96)
- `CphCapableSection` (line 113)
- `CompanionSection` (line 122)
- `SidebarSection` (line 245)

Package.json contributions: `package.json` lines 113-520

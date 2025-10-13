# Configuration Reference

Complete reference for all CPH-NG configuration settings, organized by category.

## Setting Categories

CPH-NG provides 10 categories of settings to customize behavior:

### 1. [Basic Settings](basic.md)
General extension behavior and UI preferences.

**Key Settings**:
- Folder selection method

**Related Features**: [Load Test Cases](../features/load-test-cases.md)

---

### 2. [Compilation Settings](compilation.md)  
Compiler configuration for C, C++, and Java.

**Key Settings**:
- Compiler paths and arguments
- Compilation timeout
- Wrapper and hook support

**Related Features**: [Run Single Test](../features/run-single-test.md), [Run All Tests](../features/run-all-tests.md)

---

### 3. [Runner Settings](runner.md)
Program execution and resource measurement.

**Key Settings**:
- Time additions and thresholds
- Output size limits
- Advanced runner for memory tracking

**Related Features**: [Run Single Test](../features/run-single-test.md), [Run All Tests](../features/run-all-tests.md)

---

### 4. [Comparing Settings](comparing.md)
Output comparison and verdict determination.

**Key Settings**:
- Output limit exceeded threshold
- Presentation error handling
- Error output behavior

**Related Features**: [Compare Output](../features/compare-output.md), [Run Single Test](../features/run-single-test.md)

---

### 5. [Brute Force Compare Settings](brute-force.md)
Settings for brute force comparison feature.

**Key Settings**:
- Generator time limit
- Brute force solution timeout

**Related Features**: [Brute Force Compare](../features/brute-force-compare.md)

---

### 6. [Problem Settings](problem.md)
Problem file management and defaults.

**Key Settings**:
- Default time and memory limits
- File path templates
- Template file location
- Test case loading behavior

**Related Features**: [Create Problem](../features/create-problem.md), [Edit Problem](../features/edit-problem.md), [Load Test Cases](../features/load-test-cases.md)

---

### 7. [Cache Settings](cache.md)
Compilation cache and temporary files.

**Key Settings**:
- Cache directory location
- Cleanup behavior

**Related Features**: [Run Single Test](../features/run-single-test.md), [Run All Tests](../features/run-all-tests.md)

---

### 8. [CPH Compatibility Settings](cph-compat.md)
Integration with original CPH extension.

**Key Settings**:
- Automatic CPH detection
- Import compatibility options

**Related Features**: [CPH Import](../features/cph-import.md), [Import Problem](../features/import-problem.md)

---

### 9. [Competitive Companion Settings](companion.md)
Browser extension integration settings.

**Key Settings**:
- Listen port configuration
- File naming conventions
- Auto-import behavior
- Platform-specific options
- Submission settings

**Related Features**: [Competitive Companion](../features/competitive-companion.md), [Submit to Codeforces](../features/submit-codeforces.md)

---

### 10. [Sidebar Settings](sidebar.md)
UI customization for the CPH-NG panel.

**Key Settings**:
- Theme and colors
- Status display options
- Font customization
- Animation preferences

**Related Features**: All features (affects UI display)

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

## Navigation

Click any category above to view detailed settings documentation with:

- Setting descriptions and types
- Default values
- User impact explanations
- Configuration examples
- Related features

## Need Help?

- Check [FAQ](../faq.md) for common questions
- See [Quick Start](../quickStart.md) for basic setup
- Visit individual feature pages for feature-specific settings

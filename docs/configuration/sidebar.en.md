# Sidebar Settings

Settings that customize the appearance of the CPH-NG problem panel sidebar.

## Theme and Colors

### `cph-ng.sidebar.theme`

Color theme for the sidebar panel.

- **Type**: String enum
- **Default**: `"default"`
- **Options**: `"default"`, `"light"`, `"dark"`
- **User Impact**: Controls the color scheme of the problem panel:
  - `"default"`: Follows VS Code theme
  - `"light"`: Always use light theme
  - `"dark"`: Always use dark theme

**Example**:
```json
{
  "cph-ng.sidebar.theme": "dark"
}
```

*Problem panel uses dark theme regardless of VS Code theme.*

## Font Customization

### `cph-ng.sidebar.fontFamily`

Font family for text in the sidebar panel.

- **Type**: String
- **Default**: `""` (empty - uses system default)
- **User Impact**: Changes the font used for test cases, output, and problem information. Use font names installed on your system.

**Examples**:

```json
{
  "cph-ng.sidebar.fontFamily": "JetBrains Mono"
}
```

*Use JetBrains Mono font for all panel text.*

```json
{
  "cph-ng.sidebar.fontFamily": "Fira Code, Consolas, monospace"
}
```

*Use Fira Code with fallbacks.*

!!! tip "Monospace Fonts"
    For better alignment of input/output data, use monospace fonts like:
    - JetBrains Mono
    - Fira Code
    - Source Code Pro
    - Consolas (Windows default)
    - Monaco (macOS default)

## Status Display

### `cph-ng.sidebar.showElapsedTime`

Display elapsed time since problem was created.

- **Type**: Boolean
- **Default**: `true`
- **User Impact**:
  - `true`: Shows time tracker in problem panel (e.g., "15m 30s elapsed")
  - `false`: Hides elapsed time display

**Example**:
```json
{
  "cph-ng.sidebar.showElapsedTime": false
}
```

*Hide the problem elapsed time display.*

### `cph-ng.sidebar.showMemory`

Display memory usage for test case results.

- **Type**: Boolean
- **Default**: `true` (when runner enabled)
- **User Impact**:
  - `true`: Shows memory usage in test results (requires runner to be enabled)
  - `false`: Hides memory information

**Example**:
```json
{
  "cph-ng.sidebar.showMemory": false
}
```

*Don't show memory usage even if measured.*

!!! note "Memory Measurement"
    Memory is only measured when `cph-ng.runner.useRunner` is `true`. This setting only controls visibility.

## Animation Preferences

### `cph-ng.sidebar.enableAnimations`

Enable animations in the sidebar panel.

- **Type**: Boolean
- **Default**: `true`
- **User Impact**:
  - `true`: Smooth transitions when expanding/collapsing test cases
  - `false`: Instant transitions (better for slower systems)

**Example**:
```json
{
  "cph-ng.sidebar.enableAnimations": false
}
```

*Disable animations for instant UI updates.*

## When to Customize

**Change Theme**:
- Want consistent appearance regardless of VS Code theme
- Better contrast for test results
- Personal preference

**Set Font Family**:
- Prefer specific monospace font
- Better readability for test data
- Consistent with editor font

**Disable Elapsed Time**:
- Don't track time spent on problems
- Want cleaner interface
- Time tracking is distracting

**Hide Memory**:
- Memory not relevant to your problems
- Want simpler test results
- Not using runner

**Disable Animations**:
- Performance issues on slower systems
- Prefer instant feedback
- Animations are distracting

## Example Configurations

### Minimal Interface
```json
{
  "cph-ng.sidebar.showElapsedTime": false,
  "cph-ng.sidebar.showMemory": false,
  "cph-ng.sidebar.enableAnimations": false
}
```

### Custom Font Setup
```json
{
  "cph-ng.sidebar.fontFamily": "JetBrains Mono, Consolas, monospace",
  "cph-ng.sidebar.theme": "dark"
}
```

### Performance Optimized
```json
{
  "cph-ng.sidebar.enableAnimations": false,
  "cph-ng.sidebar.showMemory": false
}
```

## Related Features

- [Edit Problem](../features/edit-problem.md) - Where elapsed time is shown
- [Run Single Test](../features/run-single-test.md) - Results displayed in sidebar
- [Run All Tests](../features/run-all-tests.md) - Multiple results in sidebar
- [Runner Settings](runner.md) - Controls memory measurement

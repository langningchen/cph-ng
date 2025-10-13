# Basic Settings

General settings that control UI behavior and folder selection methods.

## Folder Selection

### `cph-ng.basic.folderOpener`

Controls which method is used for selecting folders in dialogs.

- **Type**: String enum (`"default"` | `"native"`)
- **Default**: `"default"`
- **User Impact**:
  - `"default"`: Uses VS Code's standard folder picker (works in all environments including remote development)
  - `"native"`: Uses system native folder dialog (may provide better UX on local systems but doesn't work in remote/web environments)

**Example**:
```json
{
  "cph-ng.basic.folderOpener": "native"
}
```

*When loading test cases from a folder, the system's native folder picker will be used instead of VS Code's dialog.*

## When to Change This Setting

- **Use "default"**: If you work with remote development (SSH, WSL, containers), or experience issues with folder selection
- **Use "native"**: If you prefer your operating system's folder picker and work only on local files

## Related Features

- [Load Test Cases](../features/load-test-cases.md) - Uses folder selection when loading from folders

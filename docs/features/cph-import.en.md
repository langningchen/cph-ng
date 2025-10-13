# CPH Import

Batch import problems from original CPH extension format.

## Overview

CPH Import command allows batch importing multiple problems from the original CPH extension. Useful when migrating from CPH to CPH-NG.

## UI Interaction

### Triggering

**Command Palette**:
1. Press Ctrl+Shift+P (Cmd+Shift+P on macOS)
2. Type: "CPH-NG: Import from CPH"
3. Select command
4. Choose files to import

### Prerequisites

- CPH problem files (.prob) must exist
- Corresponding source files should exist

## How It Works

1. Command invoked
2. Scans workspace for CPH problem files
3. Shows list of available problems
4. User selects which to import
5. Each selected problem is converted
6. Imported problems saved in CPH-NG format

## Batch Import

Unlike single [Import Problem](import-problem.md), this command:
- Imports multiple problems at once
- Scans entire workspace
- Shows selection dialog
- Preserves all problem data

## Related Features

- [Import Problem](import-problem.md) - Single problem import
- [Create Problem](create-problem.md) - Create from scratch

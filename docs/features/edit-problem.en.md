# Edit Problem

Modify problem metadata including title, URL, time limit, memory limit, and special judge settings.

## Overview

The Edit Problem feature allows you to modify various aspects of a problem after creation. You can change the problem name, URL, execution limits, and configure advanced features like Special Judge (SPJ) checkers and interactors for interactive problems.

## UI Interaction

### Triggering the Feature

**Method: Edit Button**
- Locate the pen/edit icon button in the problem title area (top-right corner)
- Click the edit icon to open the edit dialog

### Prerequisites

- A problem must be loaded for the current file
- The problem panel must be visible in the sidebar

### UI Components

**Edit Dialog** contains:
- **Title Field**: Text input for problem name
- **URL Field**: Text input for problem URL (optional)
- **Time Limit**: Number input in milliseconds
- **Memory Limit**: Number input in MB
- **Checker Section**: Choose or remove Special Judge program
- **Interactor Section**: Choose or remove interactor for interactive problems
- **Save/Cancel Buttons**: Apply or discard changes

## Internal Operation

### How It Works

1. **Open Dialog**: Clicking edit button opens a modal dialog with current values
2. **Edit Fields**: User modifies desired fields
3. **Validation**: Basic validation on save (e.g., limits must be positive numbers)
4. **Update**: Changes are applied to the problem data structure
5. **Save**: Problem file is updated with new metadata
6. **Refresh**: UI updates to show new values

### Editable Fields

**Problem Metadata**:
- **Name**: Display name for the problem
- **URL**: Link to online judge problem (if applicable)
- **Time Limit**: Maximum execution time in milliseconds (e.g., 1000 = 1 second)
- **Memory Limit**: Maximum memory usage in MB (e.g., 256 MB)

**Advanced Options**:
- **Checker**: Special Judge program for custom output validation
- **Interactor**: Program for interactive problem communication

## Configuration Options

### Default Limits

When creating problems, defaults are used from settings. Editing allows overriding these:

#### `cph-ng.problem.defaultTimeLimit`
- **Type**: `number`
- **Default**: `1000` (milliseconds)
- **Note**: Edit dialog allows changing per-problem

#### `cph-ng.problem.defaultMemoryLimit`
- **Type**: `number`
- **Default**: `512` (MB)
- **Note**: Edit dialog allows changing per-problem

## Special Judge and Interactor

### Choosing a Checker

1. In edit dialog, click "Choose Checker" button
2. Browse to select your compiled checker program
3. Checker path is displayed
4. Click "Remove Checker" to unset

**Checker Requirements**:
- Must be a compiled executable
- Should follow testlib.h conventions (recommended)
- Receives input, output, and answer files as arguments

### Choosing an Interactor

1. In edit dialog, click "Choose Interactor" button
2. Browse to select your compiled interactor program
3. Interactor path is displayed
4. Click "Remove Interactor" to unset

**Interactor Requirements**:
- Must be a compiled executable
- Communicates with solution via stdin/stdout
- Used for interactive problems

## Error Handling

### Validation Errors

**Invalid Time Limit**:
- Time limit must be positive
- Usually between 100ms and 10000ms

**Invalid Memory Limit**:
- Memory limit must be positive
- Usually between 16MB and 2048MB

**Invalid Checker/Interactor Path**:
- File must exist
- File must be executable
- Must have correct extension for platform

## Workflow Example

### Changing Time Limit

1. Click edit icon in problem title area
2. Edit dialog opens with current values
3. Modify time limit field (e.g., change from 1000 to 2000)
4. Click "Save" button
5. Problem now uses 2000ms time limit for all test runs

### Adding Special Judge

1. Compile your checker program (e.g., `checker.cpp` → `checker`)
2. Click edit icon
3. In edit dialog, click "Choose Checker"
4. Select your compiled `checker` executable
5. Save changes
6. Test cases now use your checker for validation

### Setting Up Interactive Problem

1. Compile your interactor program
2. Click edit icon
3. Click "Choose Interactor"
4. Select your compiled interactor
5. Save changes
6. Problem now runs in interactive mode

## Related Features

- [Create Problem](create-problem.md) - Initial problem setup with default limits
- [Special Judge](special-judge.md) - Detailed checker information
- [Interactive Problems](interactive-problems.md) - Interactor setup guide
- [Delete Problem](delete-problem.md) - Remove problem if needed


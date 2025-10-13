# Competitive Companion Integration

Browser extension integration for automatic problem import from online judges.

## Overview

Competitive Companion is a browser extension that sends problem data from online judges directly to CPH-NG. Click the extension icon on any problem page to automatically import all test cases and metadata.

## UI Interaction

### Setup

1. Install Competitive Companion browser extension
2. Configure listening port in CPH-NG settings (default: 27121)
3. Open a source file in VS Code
4. Navigate to problem on online judge
5. Click Competitive Companion icon
6. Problem auto-created in CPH-NG

### Supported Judges

- Codeforces
- AtCoder
- LeetCode
- Codechef
- CSES
- And many more

## Configuration

### Port Setting

#### `cph-ng.companion.listenPort`
- **Default**: `27121`
- Browser extension sends to this port

### Naming Conventions

#### `cph-ng.companion.shortCodeforcesName`
- **Default**: `true`
- Uses short problem names (A, B, C) instead of full titles

#### `cph-ng.companion.shortLuoguName`
- Shortens Luogu problem names

#### `cph-ng.companion.shortAtCoderName`
- Shortens AtCoder problem names

### File Handling

#### `cph-ng.companion.defaultExtension`
- **Default**: `.cpp`
- Extension for auto-created files

#### `cph-ng.companion.chooseSaveFolder`
- Whether to prompt for save location

## How It Works

1. User clicks extension icon on problem page
2. Extension sends JSON data to CPH-NG
3. CPH-NG receives problem metadata and test cases
4. New file created (or existing opened)
5. Problem imported with all test cases
6. Ready to start coding

## Related Features

- [Create Problem](create-problem.md) - Manual problem creation
- [Import Problem](import-problem.md) - Import from CPH

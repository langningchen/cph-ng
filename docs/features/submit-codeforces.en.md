# Submit to Codeforces

Direct submission to Codeforces online judge.

## Overview

Submit to Codeforces feature allows you to submit your solution directly to Codeforces from within VS Code, without opening a browser.

## UI Interaction

### Triggering

**Submit Button**:
- Only appears when problem URL is from Codeforces
- Icon: Upload/backup icon
- Color: Green (success)
- Click to start submission

### Prerequisites

- Problem must have valid Codeforces URL
- Must be logged into Codeforces in browser
- Source file must be saved

## How It Works

1. Click submit button
2. Extension extracts contest/problem IDs from URL
3. Opens browser for authentication
4. Submits code to Codeforces
5. Confirmation shown

## Configuration

### Language Selection

#### `cph-ng.companion.submitLanguage`
- Selects C++ compiler version for Codeforces
- Options: GCC, Clang, MSVC versions

## Related Features

- [Edit Problem](edit-problem.md) - Set problem URL
- [Competitive Companion](competitive-companion.md) - Auto-import from Codeforces

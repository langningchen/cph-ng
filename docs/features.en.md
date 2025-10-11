# Feature Guide

This guide provides a comprehensive overview of all CPH-NG features, organized by workflow and interaction pattern.

## Table of Contents

- [Getting Started](#getting-started)
- [Problem Management](#problem-management)
- [Test Case Management](#test-case-management)
- [Running and Testing](#running-and-testing)
- [Result Analysis](#result-analysis)
- [Advanced Features](#advanced-features)
- [Integration Features](#integration-features)

## Getting Started

### Opening the CPH-NG Panel

1. After installation, you'll find the CPH-NG icon in the VS Code activity bar (left sidebar)
2. Click the icon to open the CPH-NG sidebar panel
3. You can drag the panel to other locations if preferred

### Initial Setup

Before creating your first problem, you may want to configure:

- Compiler paths and flags in [Compilation Settings](configuration.md#compilation-settings)
- Default time and memory limits in [Problem Settings](configuration.md#problem-settings)
- Template file location if you use code templates

## Problem Management

### Creating a New Problem

![Create Problem](images/createProblem.png)

**How to trigger:**

- Click the `CREATE` button in the sidebar when no problem exists
- Use the command `CPH-NG: Create Problem` from the Command Palette (Ctrl/Cmd+Shift+P)
- Use the keyboard shortcut `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (macOS)

**What CPH-NG does:**

1. Creates a new source file based on your template (if configured) or a blank file
2. Opens the file in the editor
3. Creates a `.cph-ng` folder in your workspace to store problem data
4. Initializes an empty problem with default time and memory limits
5. Displays the problem panel in the sidebar

**Configuration options:**

- `cph-ng.problem.templateFile` - Path to your code template file
- `cph-ng.problem.defaultTimeLimit` - Default time limit in milliseconds (default: 1000)
- `cph-ng.problem.defaultMemoryLimit` - Default memory limit in MB (default: 512)
- `cph-ng.problem.problemFilePath` - Path pattern for storing problem data

### Importing from Competitive Companion

![Companion Import](images/loadFromFile.png)

**How to trigger:**

- Install the [Competitive Companion](https://github.com/jmerle/competitive-companion) browser extension
- Navigate to a problem on a supported online judge
- Click the Competitive Companion icon in your browser
- CPH-NG will automatically receive the problem data

**What CPH-NG does:**

1. Listens on a local port (default: 27121) for problem data
2. Automatically creates a new file with the problem name
3. Imports all sample test cases from the problem
4. Sets the time and memory limits based on the problem constraints
5. Opens the new file in the editor

**Configuration options:**

- `cph-ng.companion.listenPort` - Port to listen for Competitive Companion (default: 27121)
- `cph-ng.companion.defaultExtension` - File extension for created files (default: "cpp")
- `cph-ng.companion.addTimestamp` - Add timestamp to filename to avoid conflicts (default: true)
- `cph-ng.companion.chooseSaveFolder` - Prompt to choose save location (default: false)
- `cph-ng.companion.showPanel` - Control when to show the problem panel after import
- `cph-ng.companion.shortCodeforcesName` - Use shorter filenames for Codeforces problems (default: true)
- `cph-ng.companion.shortLuoguName` - Use shorter filenames for Luogu problems (default: true)
- `cph-ng.companion.shortAtCoderName` - Use shorter filenames for AtCoder problems (default: true)

### Editing Problem Metadata

![Edit Problem](images/editProblem.png)

**How to trigger:**

- Click the **pen icon** in the top-right corner of the problem panel

**What CPH-NG does:**

- Opens a dialog where you can edit:
  - Problem title
  - Problem URL (link to the original problem)
  - Time limit (in milliseconds)
  - Memory limit (in MB)
  - Special Judge (checker) program path
  - Interactive library (interactor) program path

**Configuration options:**

None directly related, but see [Special Judge](#special-judge) for checker configuration.

### Deleting a Problem

![Delete Problem](images/deleteProblem.png)

**How to trigger:**

- Click the **trash icon** (rightmost button) in the problem control panel

**What CPH-NG does:**

1. Shows a confirmation dialog
2. If confirmed, deletes the problem data from the `.cph-ng` folder
3. Closes the problem panel
4. Returns to the "Create Problem" view

**Note:** This does not delete your source code file, only the problem metadata and test cases.

### Elapsed Time Tracking

![Elapsed Time](images/timeElasped.png)

**What this shows:**

CPH-NG automatically tracks how long you've been working on a problem, starting from when the problem was created. This information is displayed in the problem panel header.

**Configuration options:**

None - this feature is always active.

## Test Case Management

### Adding a Single Test Case Manually

![Add Test Case](images/addTestCase.png)

**How to trigger:**

- Click the **plus icon** (leftmost button) in the control panel below the problem title

**What CPH-NG does:**

1. Creates a new empty test case
2. Expands the test case view
3. Allows you to enter:
   - Input data (stdin)
   - Expected answer (stdout)

**Configuration options:**

- `cph-ng.problem.maxInlineDataLength` - Maximum size for inline data display (default: 65536 bytes)

### Loading Test Cases from Files/Folders

![Load from File](images/loadFromFile.png)
![Load from Zip](images/loadFromZip.png)
![Load from Folder](images/loadFromFolder.png)
![Load File Confirm](images/loadFromFileConfirm.png)

**How to trigger:**

- Click the **folder icon** (second button from left) in the control panel

**What CPH-NG does:**

1. Prompts you to choose the source:
   - Load from a zip file
   - Load from a folder
2. For zip files:
   - Asks you to select the zip file
   - Extracts it to a temporary folder
   - Optionally deletes the zip after extraction
3. For folders:
   - Asks you to select the folder
4. Scans for matching input/output files:
   - Files with `.in` extension are treated as input files
   - Files with `.out` or `.ans` extension are treated as answer files
   - Matches files by basename (e.g., `test1.in` matches with `test1.out`)
5. Shows a list of found test cases for you to select
6. Imports the selected test cases

**Configuration options:**

- `cph-ng.problem.unzipFolder` - Folder pattern for extracting zip files (default: `${workspace}/.cph-ng/${zipBasenameNoExt}`)
- `cph-ng.problem.deleteAfterUnzip` - Delete zip file after extraction (default: false)
- `cph-ng.problem.clearBeforeLoad` - Clear existing test cases before loading new ones (default: true)
- `cph-ng.basic.folderOpener` - Folder selection method: "tree" or "flat" (default: "tree")

### Loading from Embedded Data

![Load from Embedded](images/loadFromEmbedded.png)

**How to trigger:**

- Use the command `CPH-NG: Load from Embedded` from the Command Palette

**What CPH-NG does:**

1. Scans the current source file for embedded test case data
2. Parses the embedded data format
3. Loads the test cases into the problem

**Note:** This feature is useful when test cases are embedded in your source file comments.

### Importing from CPH

![Import from CPH](images/importFromCph.png)
![Imported from CPH](images/importedFromCph.png)

**How to trigger:**

- Click the `IMPORT` button when CPH data is detected in the workspace
- Or use the command `CPH-NG: Import from CPH`

**What CPH-NG does:**

1. Searches for `.cph` folders in your workspace (original CPH format)
2. Converts CPH problem format to CPH-NG format
3. Imports all test cases and problem metadata
4. Creates corresponding `.cph-ng` problem data

**Configuration options:**

- `cph-ng.cphCapable.enabled` - Enable CPH compatibility features (default: true)

### Toggling Between File and Inline Display

![Toggle to File](images/toggleToFile.png)
![Toggle to Inline Large](images/toogleToInlineLarge.png)

**How to trigger:**

- Click the **file toggle icon** next to input, output, or answer fields in a test case

**What CPH-NG does:**

- **Toggle to File:**
  1. Saves the data to an external file in the `.cph-ng` folder
  2. Displays the filename instead of inline content
  3. You can click the filename to view the file
  
- **Toggle to Inline:**
  1. Reads the file content
  2. If the file is too large (exceeds `maxInlineDataLength`), shows a warning
  3. If confirmed or file is small enough, displays content inline

**Configuration options:**

- `cph-ng.problem.maxInlineDataLength` - Threshold for warning when toggling large files to inline (default: 65536 bytes)

### Editing Test Case Data

**How to trigger:**

- Click directly on the input or answer field of a test case

**What CPH-NG does:**

1. Makes the field editable
2. Allows you to modify the content
3. Automatically saves changes

### Setting Output as Answer

![Before Set as Answer](images/beforeSetAsAnswer.png)
![After Set as Answer](images/afterSetAsAnswer.png)

**How to trigger:**

- Click on the answer field when a test case has output

**What CPH-NG does:**

1. Copies the current output to the answer field
2. Updates the test case result based on the new answer

**Use case:** When you verify that your program's output is correct, you can quickly set it as the expected answer.

### Deleting a Test Case

**How to trigger:**

- Click the **trash icon** next to a test case

**What CPH-NG does:**

1. Removes the test case from the problem
2. Deletes associated files if the test case used external files

## Running and Testing

### Running a Single Test Case

**How to trigger:**

- Click the **green play button** next to a specific test case

**What CPH-NG does:**

1. Saves the current source file if modified
2. Compiles the program if needed (or uses cached binary if unchanged)
3. Runs the program with the test case input
4. Captures stdout, stderr, execution time, and memory usage
5. Compares output with expected answer
6. Displays the result status (AC, WA, TLE, etc.)

**Configuration options:**

See [Compilation Settings](configuration.md#compilation-settings) and [Runner Settings](configuration.md#runner-settings)

### Running All Test Cases

![Test Case Run](images/testCaseRun.png)
![File Test Case](images/fileTestCase.png)

**How to trigger:**

- Click the **play button** in the center of the control panel

**What CPH-NG does:**

1. Saves the current source file
2. Compiles the program if needed
3. Runs all test cases sequentially
4. Updates each test case with its result
5. Automatically scrolls to and expands the first non-AC test case
6. Shows a summary of results (e.g., "3/5 AC")

**Note:** You can stop execution at any time by clicking the stop button that appears during execution.

### Stopping Test Execution

**How to trigger:**

- Click the **stop button** that appears during execution

**What CPH-NG does:**

1. Terminates the currently running test case
2. Cancels execution of remaining test cases
3. Shows "SK" (Skipped) status for cancelled tests

**Options:**

- When prompted, you can choose to:
  - Stop only the current test case
  - Stop all remaining test cases

## Result Analysis

### Understanding Judge Results

CPH-NG provides detailed feedback through 21 different statuses:

| Status | Full Name | Meaning |
|--------|-----------|---------|
| **UKE** | Unknown Error | An unexpected error occurred |
| **AC** | Accepted | Correct answer |
| **PC** | Partially Correct | Some outputs are correct |
| **PE** | Presentation Error | Output format is incorrect |
| **WA** | Wrong Answer | Incorrect output |
| **TLE** | Time Limit Exceeded | Exceeded time limit |
| **MLE** | Memory Limit Exceeded | Exceeded memory limit |
| **OLE** | Output Limit Exceeded | Generated too much output |
| **RE** | Runtime Error | Program crashed |
| **RF** | Restricted Function | Used forbidden operations |
| **CE** | Compilation Error | Failed to compile |
| **SE** | System Error | Judging system error |
| **WT** | Waiting | Waiting to run |
| **FC** | File Created | Test case files ready |
| **CP** | Compiling | Currently compiling |
| **CPD** | Compiled | Compilation finished |
| **JG** | Judging | Currently running |
| **JGD** | Judged | Execution finished |
| **CMP** | Comparing | Comparing output |
| **SK** | Skipped | Execution skipped |
| **RJ** | Rejected | Invalid submission |

**Configuration options:**

- `cph-ng.sidebar.hiddenStatuses` - Array of status codes to hide in the UI

### Comparing Output with Answer

![Compare with Answer](images/compareWithAnswer.png)

**How to trigger:**

- Click the **compare icon** (leftmost button) in the output area of a WA test case

**What CPH-NG does:**

1. Opens a side-by-side comparison view
2. Highlights differences between your output and expected answer
3. Shows line-by-line differences

**Configuration options:**

- `cph-ng.comparing.regardPEAsAC` - Treat Presentation Error as Accepted (default: false)
- `cph-ng.comparing.ignoreError` - Ignore stderr when comparing (default: true)
- `cph-ng.comparing.oleSize` - Number of MB that triggers OLE (default: 3)

### Viewing Execution Details

Each test case displays:

- **Status**: Current judge result (AC, WA, TLE, etc.)
- **Time**: Execution time in milliseconds
- **Memory**: Memory usage in MB (if runner is enabled)
- **Input**: Test case input (or filename if stored externally)
- **Output**: Your program's output (or filename if stored externally)
- **Answer**: Expected answer (or filename if stored externally)
- **Error**: Standard error output if any

### Clearing Test Results

**How to trigger:**

- Click the **clear icon** next to a test case or in the control panel

**What CPH-NG does:**

1. Clears the output, error, time, and memory data
2. Resets the status to initial state
3. Keeps the input and answer intact

## Advanced Features

### Special Judge

![Special Judge](images/specialJudge.png)

**How to set up:**

1. Click the **pen icon** to edit problem metadata
2. Click "Choose Checker" button
3. Select your checker program file

**What CPH-NG does:**

1. When running test cases, passes three files to the checker:
   - Input file
   - Your output file
   - Expected answer file
2. Reads the checker's exit code:
   - Exit code 0 = AC (Accepted)
   - Exit code 1 = WA (Wrong Answer)
   - Exit code 2 = PE (Presentation Error)
3. Reads the checker's output for additional feedback

**Checker requirements:**

- Must be a compiled executable (C/C++ recommended)
- Should follow testlib.h format or return appropriate exit codes
- Should receive input, output, and answer filenames as command-line arguments

**Configuration options:**

None specific to SPJ, but compilation settings apply if you need to compile your checker.

### Interactive Problems

**How to set up:**

1. Click the **pen icon** to edit problem metadata
2. Click "Choose Interactor" button
3. Select your interactor program file

**What CPH-NG does:**

1. Starts the interactor process
2. Connects your program's stdout to interactor's stdin
3. Connects interactor's stdout to your program's stdin
4. Monitors the interaction until completion
5. Reads the interactor's verdict

**Interactor requirements:**

- Must be a compiled executable
- Should handle bidirectional communication
- Should output a verdict at the end

### Brute Force Comparison

**How to set up:**

1. Create a generator program that produces random test inputs
2. Create a brute force solution that is correct but slow
3. Create your optimized solution
4. Use the command `CPH-NG: Brute Force Compare`

**What CPH-NG does:**

1. Runs the generator to create a random test case
2. Runs the brute force solution to get the expected answer
3. Runs your solution and compares with the brute force answer
4. Repeats until a mismatch is found or you stop it
5. If a mismatch is found, saves it as a new test case

**Configuration options:**

- `cph-ng.bfCompare.generatorTimeLimit` - Time limit for generator in seconds (default: 10)
- `cph-ng.bfCompare.bruteForceTimeLimit` - Time limit for brute force solution in seconds (default: 60)

### Compilation Optimization

**Smart Caching:**

CPH-NG calculates a hash of your source code and compiler settings. If nothing has changed since the last compilation, it reuses the cached binary, significantly speeding up test execution.

**How it works:**

1. Before compilation, CPH-NG hashes:
   - Source file content
   - Compiler path and flags
   - Language-specific settings
2. Compares hash with previous compilation
3. If matched, skips compilation
4. If different, compiles and updates the hash

**Configuration options:**

- `cph-ng.compilation.timeout` - Maximum compilation time in milliseconds (default: 10000)

### Custom Compilation Hooks

**How to set up:**

1. Enable `cph-ng.compilation.useWrapper` or `cph-ng.compilation.useHook`
2. Create a wrapper script that modifies compilation behavior

**What CPH-NG does:**

- **Wrapper mode**: Wraps the entire compilation command
- **Hook mode**: Calls your hook before/after compilation

**Use cases:**

- Add custom preprocessing
- Copy additional files
- Generate resources
- Custom sanitizer options

**Configuration options:**

- `cph-ng.compilation.useWrapper` - Enable wrapper mode (default: false)
- `cph-ng.compilation.useHook` - Path to hook script (default: false)

## Integration Features

### Codeforces Submission

**How to trigger:**

- Use the command `CPH-NG: Submit to Codeforces`

**Requirements:**

1. Install and configure cf-tool
2. Problem must be imported from Codeforces via Competitive Companion

**What CPH-NG does:**

1. Validates that the problem is from Codeforces
2. Prompts for language selection if not configured
3. Calls cf-tool to submit your solution
4. Shows submission result

**Configuration options:**

- `cph-ng.companion.submitLanguage` - Default language ID for submission (default: -1, prompt each time)

### Git Integration

CPH-NG respects your `.gitignore` and automatically:

- Creates `.cph-ng` folders in your workspace
- Stores compiled binaries in cache directories
- Keeps problem metadata separate from source code

**Recommended `.gitignore` entries:**

```
.cph-ng/
*.bin
*.exe
```

### Language Model Tools (Copilot)

CPH-NG provides AI assistant integration through two tools:

**1. Run Test Cases Tool**

Allows AI assistants to:
- Run specific test cases
- Run all test cases
- Get execution results

**2. Read Problem File Tool**

Allows AI assistants to:
- Read test input files
- Read test output files
- Read expected answer files
- Read error output files

These tools enable AI assistants to help debug your code by analyzing test results.

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Create Problem | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| Run Test Cases | Custom binding available | Custom binding available |

**Customizing shortcuts:**

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Search "Preferences: Open Keyboard Shortcuts"
3. Search for "CPH-NG" commands
4. Set your preferred keybindings

## Tips and Best Practices

### Workflow Tips

1. **Use Templates**: Set up a template file with your common includes and code structure
2. **Organize by Contest**: Create folders for each contest to keep problems organized
3. **Test Incrementally**: Run test cases as you develop, don't wait until the end
4. **Save Large Cases as Files**: Use the file toggle for test cases with large input/output
5. **Use Brute Force Compare**: When debugging, use brute force comparison to find edge cases

### Performance Tips

1. **Enable Caching**: The default settings already enable compilation caching
2. **Use File Storage**: For very large test cases, store them as files instead of inline
3. **Clean Cache Periodically**: Enable `cph-ng.cache.cleanOnStartup` to avoid cache buildup

### Troubleshooting Tips

1. **Compilation Issues**: Check compiler paths in settings
2. **Timeout Issues**: Increase time limits in runner settings
3. **Memory Issues**: Increase memory limit or enable runner for accurate measurements
4. **Path Issues**: Use absolute paths or workspace-relative paths in configuration

## Next Steps

- Learn about all [Configuration Options](configuration.md)
- Check the [FAQ](faq.md) for common questions
- Visit the [GitHub repository](https://github.com/langningchen/cph-ng) for support

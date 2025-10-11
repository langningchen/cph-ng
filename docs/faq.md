# Frequently Asked Questions

## General Questions

### What is CPH-NG?

CPH-NG (Competitive Programming Helper - Next Generation) is a VS Code extension for competitive programming. It helps you compile, run, and judge your solutions locally with test cases imported from online judges or created manually.

See the [Overview](index.md) for more information.

### How is CPH-NG different from the original CPH?

CPH-NG is a complete rewrite with many enhancements:

- More judging statuses (21 vs 3)
- Compilation caching for faster testing
- Support for loading test cases from files and folders
- Special Judge (SPJ) and interactive problem support
- Brute force comparison
- Better memory management

See the comparison table in the [README](https://github.com/langningchen/cph-ng#comparison-with-cph).

### What languages does CPH-NG support?

Currently, CPH-NG supports:

- C++ (recommended for competitive programming)
- C
- Java

More languages may be added in future releases.

## Installation & Setup

### Where can I download CPH-NG?

Install directly from VS Code:

1. Open VS Code
2. Go to Extensions (Ctrl/Cmd+Shift+X)
3. Search for "CPH NG"
4. Click Install

Or use this direct link: [Install CPH-NG](vscode:extension/langningchen.cph-ng)

### How do I configure my compiler?

1. Open VS Code Settings (Ctrl/Cmd+,)
2. Search for "cph-ng compilation"
3. Configure compiler paths and flags

See [Compilation Settings](configuration.md#compilation-settings) for details.

### Can I use a custom code template?

Yes! Set the template file path in settings:

```json
{
  "cph-ng.problem.templateFile": "/path/to/your/template.cpp"
}
```

See [Problem Settings](configuration.md#problem-settings) for more options.

## Using CPH-NG

### How do I create a new problem?

Three ways:

1. Click "CREATE" in the sidebar
2. Use command palette: `CPH-NG: Create Problem`
3. Use keyboard shortcut: `Ctrl+Alt+B` (or `Cmd+Alt+B` on macOS)

See [Quick Start](quickStart.md#create-a-problem) for details.

### How do I import problems from online judges?

1. Install the [Competitive Companion](https://github.com/jmerle/competitive-companion) browser extension
2. Go to a problem on a supported judge (Codeforces, AtCoder, etc.)
3. Click the Competitive Companion icon
4. CPH-NG will automatically create the problem with test cases

See [Feature Guide - Competitive Companion](features.md#importing-from-competitive-companion) for configuration options.

### How do I load test cases from files?

1. Click the folder icon in the problem panel
2. Choose "Load from zip file" or "Load from folder"
3. Select your file/folder
4. Choose which test cases to import

CPH-NG automatically matches `.in` files with `.out`/`.ans` files by name.

See [Feature Guide - Loading from Files](features.md#loading-test-cases-from-filesfolders) for details.

### Why is my program not compiling?

Common issues:

1. **Compiler not found**: Check compiler path in settings
2. **Compilation timeout**: Increase timeout in [Compilation Settings](configuration.md#compilation-settings)
3. **Syntax errors**: Check the compilation output panel

### Why is my solution getting TLE when it should pass?

Possible reasons:

1. **Slow machine**: Increase `timeAddition` in [Runner Settings](configuration.md#runner-settings)
2. **Actual infinite loop**: Review your code logic
3. **Time limit too strict**: Edit problem metadata to increase time limit

### How do I use Special Judge?

1. Write a checker program (using testlib.h or custom)
2. Compile your checker
3. Click the pen icon to edit problem metadata
4. Click "Choose Checker" and select your compiled checker

See [Feature Guide - Special Judge](features.md#special-judge) for requirements and examples.

## Advanced Features

### What is brute force comparison?

Brute force comparison helps find edge cases by:

1. Generating random test inputs
2. Running both your optimized solution and a brute force reference
3. Comparing outputs until they differ
4. Saving the failing case as a test case

See [Feature Guide - Brute Force Comparison](features.md#brute-force-comparison) for setup instructions.

### How does compilation caching work?

CPH-NG calculates a hash of your source code and compiler settings. If nothing changed since the last compilation, it reuses the cached binary, saving time.

This is automatic and requires no configuration.

### Can I customize the folder where problems are stored?

Yes! Configure the path pattern in settings:

```json
{
  "cph-ng.problem.problemFilePath": "${workspace}/.cph-ng/${basename}.bin"
}
```

See [Problem Settings](configuration.md#problem-settings) for available variables.

### How do I hide certain judging statuses?

Configure hidden statuses in settings:

```json
{
  "cph-ng.sidebar.hiddenStatuses": ["WT", "FC", "CP", "CPD"]
}
```

See [Sidebar Settings](configuration.md#sidebar-settings) for the full list of status codes.

## Troubleshooting

### The sidebar panel is not showing

1. Check if the CPH-NG icon is in your activity bar
2. Click the icon to open the panel
3. If still not showing, try reloading VS Code (Ctrl/Cmd+Shift+P → "Developer: Reload Window")

### Test cases are not running

1. Make sure the file is saved
2. Check if compilation succeeded
3. Look for errors in the compilation output panel
4. Verify compiler settings are correct

### Memory measurements are not accurate

Enable the advanced runner:

```json
{
  "cph-ng.runner.useRunner": true
}
```

Note: May require additional system permissions.

See [Runner Settings](configuration.md#runner-settings) for details.

### Output is too large and not showing

Large outputs are automatically saved to files. You can:

1. Click the filename to view the content
2. Toggle between file and inline display using the file icon
3. Adjust the threshold in [Runner Settings](configuration.md#runner-settings)

### I'm getting permission errors on Linux/macOS

Some features may require:

1. Executable permissions on your compiler
2. Write permissions in the cache directory
3. Permissions to create files in your workspace

Check your system permissions and file ownership.

## Getting Help

### Where can I report bugs?

Report bugs on [GitHub Issues](https://github.com/langningchen/cph-ng/issues).

Please include:

- Your OS and VS Code version
- CPH-NG version
- Steps to reproduce
- Error messages or screenshots

### Where can I request features?

Feature requests are welcome on [GitHub Discussions](https://github.com/langningchen/cph-ng/discussions).

### How can I contribute?

Contributions are welcome! See the [About](about.md#contributing) page for information on how to contribute.

### Where can I find the source code?

CPH-NG is open source: [GitHub Repository](https://github.com/langningchen/cph-ng)

## Additional Resources

- [Feature Guide](features.md) - Comprehensive guide to all features
- [Configuration Reference](configuration.md) - All configuration options
- [Quick Start](quickStart.md) - Get started quickly
- [Modules](modules.md) - Additional functionality
- [About](about.md) - Project information

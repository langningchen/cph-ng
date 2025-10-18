# CPH-NG

CPH-NG (Competitive Programming Helper - Next Generation) is a **Visual Studio
Code (VS Code) extension** specifically developed for competitive programming.

CPH-NG empowers users to conveniently and efficiently **compile, run, and
judge** their programs directly within the VS Code environment.

!!! warning
    Until now, CPH NG supports C++ and Java only.

## What is CPH-NG?

CPH-NG is the next generation of the [Competitive Programming Helper](https://github.com/agrawal-d/cph), providing a comprehensive solution for competitive programmers working in VS Code. Whether you're practicing on online judges or working on your own problems, CPH-NG streamlines your workflow from problem creation to submission.

## Key Features

### 🎯 Intelligent Test Data Management

![Test Data Management](images/loadFromFile.png)

Offers **multiple flexible ways** to import test data:

- Import from [Competitive Companion](https://github.com/jmerle/competitive-companion) browser extension
- Load from zip files or directories
- Manually create test cases
- Import from CPH format
- Load from embedded data in source files

### ⚡ Smart Compilation System

CPH-NG features an intelligent compilation system that:

- Detects file changes and only recompiles when necessary
- Caches compiled binaries for faster testing
- Supports custom compiler flags and optimization levels
- Provides clear compilation error messages
- Supports compilation hooks and wrappers

### 📊 Comprehensive Judging System

CPH-NG supports **21 distinct judging statuses**:

- **AC** (Accepted) - Your solution is correct
- **PC** (Partially Correct) - Some test cases passed
- **PE** (Presentation Error) - Output format is incorrect
- **WA** (Wrong Answer) - Incorrect output
- **TLE** (Time Limit Exceeded) - Execution took too long
- **MLE** (Memory Limit Exceeded) - Used too much memory
- **OLE** (Output Limit Exceeded) - Generated too much output
- **RE** (Runtime Error) - Program crashed during execution
- **RF** (Restricted Function) - Used forbidden system calls
- **CE** (Compilation Error) - Failed to compile
- **SE** (System Error) - Internal judging error
- And more...

### 🎓 Special Judge Support

![Special Judge](images/specialJudge.png)

CPH-NG fully supports:

- **Special Judge (SPJ)** programs using testlib.h or custom checkers
- **Interactive problems** with custom interactors
- Flexible problem verification for non-standard output formats

### 🔄 Advanced Features

- **Brute Force Comparison**: Test your optimized solution against a brute force reference
- **File/Inline Toggle**: Switch between inline data and external files for large test cases
- **Elapsed Time Tracking**: Monitor how long you've been working on a problem
- **Answer Comparison View**: Visual diff for wrong answers
- **Result Persistence**: Keep track of your test results across sessions

## Quick Links

- [Quick Start Guide](quickStart.md) - Get started in minutes
- [Feature Guide](features/) - Detailed feature documentation
- [Configuration Reference](configuration.md) - All configuration options
- [FAQ](faq.md) - Frequently asked questions
- [About](about.md) - Project information and contributing

## Installation

Install CPH-NG directly from the Visual Studio Code Marketplace:

[Install CPH-NG](vscode:extension/langningchen.cph-ng)

Or search for "CPH NG" in the VS Code Extensions panel.

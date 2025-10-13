# Special Judge

Use custom checker programs for non-standard answer validation.

## Overview

Special Judge (SPJ) allows problems with multiple correct answers or custom validation logic. Instead of exact output matching, your checker program validates whether the output is correct according to problem requirements.

## UI Interaction

### Setup

1. Click edit icon in problem title
2. In edit dialog, find "Checker" section
3. Click "Choose Checker"
4. Select compiled checker executable
5. Save changes

### Requirements

- Checker must be compiled executable
- Should follow testlib.h conventions (recommended)
- Receives test input, contestant output, and expected answer as arguments

## How It Works

When SPJ is configured:
1. Your solution runs normally
2. Instead of direct comparison, checker is invoked
3. Checker receives: input file, output file, answer file
4. Checker exits with code: 0 (AC), 1 (WA), or other
5. Verdict determined by checker's exit code

## Checker Program Structure

Typical checker (C++ with testlib.h):
```cpp
#include "testlib.h"
int main(int argc, char* argv[]) {
    registerTestlibCmd(argc, argv);
    int expected = ans.readInt();
    int output = ouf.readInt();
    if (output == expected)
        quitf(_ok, "Correct");
    else
        quitf(_wa, "Wrong answer");
}
```

## Related Features

- [Edit Problem](edit-problem.md) - Configure SPJ
- [Interactive Problems](interactive-problems.md) - Alternative for two-way communication


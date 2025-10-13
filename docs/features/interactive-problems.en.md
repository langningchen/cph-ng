# Interactive Problems

Support for interactive problems with custom interactor programs.

## Overview

Interactive problems require two-way communication between your solution and a judge program. Your solution reads queries, processes them, and writes responses, with the interactor validating the interaction.

## UI Interaction

### Setup

1. Click edit icon in problem title
2. Find "Interactor" section in edit dialog
3. Click "Choose Interactor"
4. Select compiled interactor executable
5. Save changes

### Requirements

- Interactor must be compiled executable
- Communicates via stdin/stdout
- Manages the interaction protocol

## How It Works

With interactor configured:
1. Your solution starts
2. Interactor starts simultaneously  
3. Solution writes query → Interactor reads
4. Interactor writes response → Solution reads
5. Continues until solution outputs answer or error
6. Interactor determines verdict

## Example Interaction

Problem: Guess a number between 1-100

**Your Solution**:
```cpp
while(true) {
    cout << guess << endl;
    cout.flush();
    string response;
    cin >> response;
    if (response == "CORRECT") break;
    // adjust guess based on response
}
```

**Interactor**: Provides "HIGHER"/"LOWER"/"CORRECT" responses

## Related Features

- [Edit Problem](edit-problem.md) - Configure interactor
- [Special Judge](special-judge.md) - Alternative validation

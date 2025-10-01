# Change Log

All notable changes to the "cph-ng" extension will be documented in this file.

## 0.2.1

- **ci**: build failed in pull requests
- **chore**: improve changelog extraction logic for version releases
- **fix**: pc status incorrect
- **feat**: add time elapsed

## 0.2.0

Aggregated from prereleases 0.1.10~0.1.11.

### Added

- Interactive problem support
- Bulk import from CPH
- Natural-order sorting for test cases
- Configuration: max inline data length
- Short name settings for competitive programming platforms

### Fixed

- Execution time not captured when using exit
- Compilation: ensure command exit code is checked
- Incorrect data folder path in file-only mode
- Redundant warning when checker / interactor already executable

### Refactored

- Related utilities converted to static class member functions

<details>
<summary>Pre-release history (0.1.10~0.1.11)</summary>

## 0.1.11

- **fix**: check command code when compiling
- **refactor**: use static class member functions
- **fix**: data folder is incorrect in file-only mode
- **fix**: hide the warning message when the checker or interactor is an
  executable file

## 0.1.10

- **fix**: time not captured using exit
- **fix**: check command code when compiling
- **feat**: interactive problem support
- **feat**: add max inline data length configuration
- **feat**: implement bulk import from CPH
- **feat**: add short name settings for competitive programming platforms
- **feat**: add natural-orderby for sorting test cases

</details>

---

**Versions above this line: patch changes are released as prerelease, minor
changes are released as stable**

---

## 0.1.9

- **fix**: ignore empty request data in companion
- **fix**: show or hide compilation channel based on message content
- **feat**: add file toggle
- **fix**: improve folder selection display in quick pick
- **feat**: add showPanel setting to control visibility of the problem source
  file panel
- **fix**: handle undefined time in tc result condition
- **feat**: add version info command and update bug report template

## 0.1.8

- **feat**: implement wrapper and hook functionality for compilation process
- **fix**: add message for compilation aborted by user
- **fix**: include compiler settings in hash calculation for compilation

## 0.1.7

- **fix**: remove SVG badges from README to fix publishing

## 0.1.6

Nothing changed, just dump version to publish a new version.

## 0.1.5

- **fix**: the expand animation of test case view
- **refactor**: extract the embedded data function
- **feat**: implement folder chooser utility and add configuration options for
  folder selection method
- **fix**: improve checker path validation by checking file extensions

## 0.1.4

- **feat**: submit to codeforces
- **docs**: add zh-CN readme
- **feat**: customize font family

## 0.1.3

- **fix**: fixed OLE logic
- **feat**: changed default value of cph-ng.comparing.oleSize to 3

## 0.1.2

- **fix**: prevent the window from becoming unresponsive when old problem data
  is present
- **feat**: support more old versions of problem files

## 0.1.1

- **fix**: an issue with cannot delete problem
- **feat**: add support for migration from old problem files
- **fix**: do not trim stdout and stderr

## 0.1.0

- **feat**: add support for brute force comparison
- **feat**: use relative path in .cph-ng folder to avoid files with same
  filename in different sub-folders
- **refactor**: enhance checker UI
- **feat**: allow user to stop only current test case when running all test
  cases

## 0.0.12

- **feat**: add stderrThreshold configuration to control stderr output handling
- **fix**: do not create .cph-ng folder when there is no problem saved

## 0.0.11

- **feat**: import and export from embedded data
- **feat**: add option to clear test cases before loading new ones

## 0.0.10

- **fix**: problem title in small screens
- **fix**: add constrain to time limit
- **feat**: add tips when there is no problem
- **fix**: translation mistakes
- **fix**: use longer interval for CPH checks
- **fix**: use manual cph import
- **chore**: upgrade dependencies

## 0.0.9

- **feat**: Use the new Icon
- **fix**: Constantly check CPH status
- **fix**: Remove unsupported schema keyword minimum
- **feat**: Add unzip folder configuration
- **feat**: Add placeholder `basenameNoExt`
- **feat**: Add delete zip after unzip configuration

## 0.0.8

- **fix**: Localize messages in LlmFileReader and LlmTcRunner for better
  internationalization support
- **fix**: Edit problem dialog changes with file

## 0.0.7

- **feat**: Hold `Ctrl` to force recompilation and `Alt` to skip compilation
- **fix**: Changing to answer file will not be considered as changing problem
  now
- **feat**: Introduce LLM tools for test case execution and file reading

## 0.0.6

- **feat**: Add error popup when webview handle occurs error
- **fix**: Cph auto import

## 0.0.5

- **fix**: Stop running when changes problem
- **fix**: Use correct output path
- **fix**: Correctly access stdout and stderr paths

## 0.0.4

- **feat**: Add problem file path configuration.
- **feat**: Add logging to help identify issues.
- **feat**: Implement ErrorBoundary component.
- **fix**: Hide empty stderr or message.

## 0.0.3

- **feat**: Add support for saving unsaved changes in the editor before
  compilation.
- **fix**: The "file not found" warning no longer appears when the current
  source file does not have a problem.
- **feat**: Add support for SPJ using testlib.

## 0.0.2

- **fix**: The icon in problem actions has been enlarged.
- **fix**: The "file not found" warning no longer appears when data is received
  from the companion app.
- **fix**: The test case status now updates correctly after a compilation error
  (CE) occurs.

## 0.0.1

- Initial release

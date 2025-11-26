# Change Log

All notable changes to the "cph-ng" extension will be documented in this file.

## 0.4.10

- **fix**: no editor
- **fix**: robust the drag and drop

## 0.4.9

- **feat**: enhance path handling for moved workspace in problem data
- **feat**: add javascript language support
- **feat**: special judge templates
- **refactor**: add cache dispose and migration logic for problem management
- **fix**: cache runner program
- **fix**: show panel not working in new opening mode

## 0.4.8

- **feat**: drag and drop to webview
- **refactor**: change core process logic
- **feat**: add support for unlimited stack size in runner
- **fix**: remove source file indicator in problem title
- **feat**: unified test case extension
- **feat**: add customizable companion data handling
- **fix**: use correct unit for brute force compare
- **fix**: use file to enhance robustness
- **feat**: unify file limit threshold
- **refactor**: types and imports for backend compatibility
- **fix**: stop running may not work
- **fix**: subprocess may exist before we start listening

## 0.4.7

- **fix**: set problem source path when loading a problem
- **fix**: create and import problem using keyboard shortcut
- **feat**: focus back on editor after keyboard shortcut
- **feat**: changed default value of cph-ng.comparing.oleSize to 8
- **feat**: let llm decide active file path
- **fix**: add tcOrder to required properties in problem schema
- **fix**: update error message to prompt user
- **feat**: use inline copy message

## 0.4.6

- **fix**: use better migration logic

## 0.4.5

- **fix**: migrate issues

## 0.4.4

- **fix**: configuration disorder in settings

## 0.4.3

- **fix**: disable show tips
- **fix**: disable auto focus
- **feat**: add disable/enable test case feature
- **chore**: upgrade packages
- **fix**: update debounce import path in extensionManager

## 0.4.2

- **fix**: replace dynamic version with static version in migration logic
- **fix**: use raw string for outputPath in Python compilation command

## 0.4.1

- **fix**: compare test case

## 0.4.0

Aggregated from prereleases 0.3.1~0.3.8.

### Added

- Python support with PyPy
- Debugger with testcase input feature
- Automatic unlimited stack configuration for deep recursion
- Drag-and-drop reordering with real-time preview
- Support configurable test-case extensions and detect related files

### Fixed

- Update URL host checks to use endsWith for better accuracy
- Debug not working
- C/C++ compile options order
- Test cases are not cleared after loading empty test cases
- Windows file comparison by using Uri.file() for filesystem paths
- Reading file in windows
- Incorrect file extension

### Changed

- Store test cases as UUID-keyed map and add tcOrder
- Upgrade packages
- Problem version migration

<details>
<summary>Pre-release history (0.3.1~0.3.8)</summary>

## 0.3.8

- **fix**: update URL host checks to use endsWith for better accuracy
- **refactor**: llm tools and enhance test case management
- **feat**: add python support with pypy

## 0.3.7

- **fix**: debug not working
- **feat**: store test cases as UUID-keyed map and add tcOrder
- **feat**: support configurable test-case extensions and detect related files
- **chore**: upgrade packages
- **fix**: problem version migration

## 0.3.6

Nothing changed, just dump version to publish a new version.

## 0.3.5

Nothing changed, just dump version to publish a new version.

## 0.3.4

Nothing changed, just dump version to publish a new version.

## 0.3.3

- **fix**: c/c++ compile options order
- **fix**: test cases are not cleared after loading empty test cases
- **fix**: Windows file comparison by using Uri.file() for filesystem paths
- **feat**: add automatic unlimited stack configuration for deep recursion
- **feat**: add debugger with testcase input feature
- **feat**: add drag-and-drop reordering with real-time preview and improve
  input focus workflow

## 0.3.2

- **fix**: reading file in windows

## 0.3.1

- **fix**: incorrect file extension

</details>

## 0.3.0

Aggregated from prereleases 0.2.1~0.2.4.

### Added

- Custom file system support
- Bulk import from CPH
- Interactive problem support
- Edit raw problem data
- Natural-order sorting for test cases
- Double-click test case data title to open in editor
- Configuration options: max inline data length, stdoutThreshold, default file
  extension, memory limit
- Clear test case result
- Short name settings for competitive programming platforms
- Time elapsed statistics

### Fixed

- Ensure document is saved before compilation
- Compilation timeout message
- Show reject when cancelling compile
- Fix OLE when output and answer are both empty
- Batch import issues
- Incorrect data folder path in file-only mode
- Execution time not captured when using exit
- Compilation command exit code check
- Redundant warning when checker/interactor already executable
- Other bug fixes and experience improvements

### Changed

- Refactored utilities to static class members
- Enable background running
- Variable name improvements
- Logic refactoring

<details>
<summary>Pre-release history (0.2.1~0.2.4)</summary>

## 0.2.4

- **feat**: add build type
- **feat**: double click test case data title to open in editor

## 0.2.3

- **fix**: ensure document is saved before proceeding with compilation
- **fix**: add message for compilation timeout
- **style**: rename confusing variable names
- **refactor**: enable background running
- **fix**: remove embedded data save and load
- **fix**: no ole when the output and answer are both empty
- **feat**: add debounce for editor change event
- **feat**: add stdoutThreshold configuration to control stdout output handling
- **feat**: clear test case result
- **feat**: add custom file system
- **feat**: edit raw problem data
- **fix**: show reject when cancelling compile
- **fix**: batch import from cph

## 0.2.2

- **feat**: add default file extension setting for Competitive Companion
- **fix**: use shorter hash for io cache
- **feat**: add runner support and memory limit setting

## 0.2.1

- **ci**: build failed in pull requests
- **chore**: improve changelog extraction logic for version releases
- **fix**: pc status incorrect
- **feat**: add time elapsed

</details>

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

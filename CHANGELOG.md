# Change Log

All notable changes to the "cph-ng" extension will be documented in this file.

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

# CPH-NG Developer Instructions

CPH-NG is a VS Code extension for competitive programming that compiles, runs,
and judges test cases. It's the next generation of CPH (Competitive Programming
Helper).

## Architecture Overview

### Core Components

- **Extension Entry**: `src/extension.ts` delegates to
  `ExtensionManager.activate/deactivate`
- **ExtensionManager** (`src/modules/extensionManager.ts`): Central coordinator,
  registers commands, sets up webview provider, Language Model tools, and file
  system provider
- **ProblemsManager** (`src/modules/problemsManager.ts`): Manages problem
  lifecycle - loading, saving, running test cases, and coordinating
  compilation/execution
- **Compiler** (`src/core/compiler.ts`): Orchestrates compilation of source
  files, checkers, interactors, and brute-force comparison programs
- **Runner** (`src/core/runner.ts`): Executes compiled programs with test case
  I/O, handles timeouts, memory limits, and verdict determination
- **SidebarProvider** (`src/modules/sidebarProvider.ts`): Webview panel for
  problem management UI
- **Companion** (`src/modules/companion.ts`): HTTP server (port 27121) for
  Competitive Companion browser extension integration
- **CphCapable** (`src/modules/cphCapable.ts`): Backward compatibility layer for
  importing CPH problems

### Data Model

Problems are stored as compressed JSON in `.cph-ng/` directories (configurable
via `cph-ng.problem.problemFilePath` template). See `res/problem.schema.json`
for the schema.

**Key Types** (see `src/utils/types.ts`):

- `Problem`: Source file, test cases (keyed by UUID), time/memory limits,
  optional checker/interactor/brute-force
- `Tc`: Test case with stdin/answer (inline data or file paths), result verdict,
  and expand state
- `TCIO`: Union type for inline data (`{useFile: false, data: string}`) or file
  reference (`{useFile: true, path: string}`)
- `TcVerdict`: Result status (AC, WA, TLE, etc.) with name, full name, and color

### Language Support

Languages are in `src/core/langs/` - currently C/C++ (`cpp.ts`), C (`c.ts`), and
Java (`java.ts`). Each implements the `Lang` interface with `compile()` method.

**Compilation Features**:

- **Wrapper** (`res/wrapper.cpp`): Injects stdin/stdout redirection into
  binaries (enabled via `cph-ng.compilation.useWrapper`)
- **Hook** (`res/hook.cpp`): Memory/time tracking via `objcopy` symbol injection
  (enabled via `cph-ng.compilation.useHook`)
- **Runner** (`res/runner-linux.cpp` / `res/runner-windows.cpp`): Separate
  process for resource monitoring (enabled via `cph-ng.runner.useRunner`)
- **Caching**: SHA-256 hash of source code skips recompilation when unchanged

### Webview Architecture

**Frontend**: React app (`src/webview/App.tsx`) compiled by webpack to
`dist/frontend.js`

- Built with Material-UI components
- Uses `react-i18next` for translations (`src/webview/l10n/en.json`, `zh.json`)
- Message passing via `window.postMessage` (see `src/webview/src/msgs.ts` for
  protocol)

**Backend→Frontend**: Events sent via `sidebarProvider.event.emit()` → webview
receives via `window.onmessage` **Frontend→Backend**: `msg()` function posts to
extension → `ProblemsManager` handles messages

## Development Workflow

### Build System

- **Dev build**: `pnpm run watch` (starts webpack in watch mode)
- **Production build**: `pnpm run compile`
- **Extension debugging**: Press F5 in VS Code to launch Extension Development
  Host
- **Webpack config**: Two entries - `extensionConfig` (Node target) and
  `webviewConfig` (Web target)
- **Build metadata**: Webpack plugin generates `dist/generated.json` with commit
  hash, build time, and builder info

### Translation System

**Three translation layers** (all must be synchronized):

1. **VSCode Extension Configuration** (`package.json`):
   - References: `%key%` syntax
   - English: `package.nls.json`
   - Chinese: `package.nls.zh.json`

2. **Extension Runtime** (TypeScript code):
   - Usage: `l10n.t('key')` or `l10n.t('template {var}', {var: value})`
   - Chinese: `l10n/bundle.l10n.zh-cn.json`
   - English: embedded in code as default

3. **Webview UI** (React):
   - Usage: `t('key')` hook from `react-i18next`
   - English: `src/webview/l10n/en.json`
   - Chinese: `src/webview/l10n/zh.json`

**Translation enforcement**: Git pre-commit hook (`scripts/pre-commit`)
validates all translation keys are complete. Run manually:
`pnpm run check-translations`

### Git Workflow

- **Commit conventions**: Conventional Commits enforced by commitlint (`feat:`,
  `fix:`, `docs:`, etc.)
- **Pre-commit hooks**: Install with `pnpm run install-hooks` - checks
  translations before each commit
- **Bypass (not recommended)**: `git commit --no-verify`

## Project-Specific Patterns

### Problem State Management

Problems exist in two states:

1. **Active**: Currently open file with associated problem - managed in
   `ProblemsManager.fullProblems[]`
2. **Persistent**: Saved to disk as compressed JSON when editor changes or
   extension deactivates

Time tracking: `startTime` records when problem becomes active, `timeElapsed`
accumulates total working time

### Compilation Options

Pass `compile: boolean | null` to control behavior:

- `true`: Force recompile
- `false`: Force use cache (fails if no cache)
- `null`: Auto-decide based on hash comparison (standard behavior)

### Test Case Execution

**Single Tc**: `runTc()` compiles once, runs one test case **All TCs**:
`runTcs()` compiles once, iterates through `tcOrder[]` array **Abort handling**:
`AbortController` with special reason `'onlyOne'` stops batch but allows
continuation

Verdicts use running states (`CP`, `CPD`, `JG`, `JGD`, `CMP`) to show progress
before final results

### Virtual File System

Test case I/O accessible via custom URI scheme:
`cph-ng://<src-path>/<tc-uuid>/<type>` where type is
`stdin`/`stdout`/`answer`/`stderr`. Implemented in `FileSystemProvider` for diff
views.

### Special Features

- **Interactive problems**: Uses `interactor` file that communicates via
  stdin/stdout
- **Special judge**: Uses `checker` file that validates output (receives stdin,
  output, answer as args)
- **Brute-force comparison**: Generator creates input → Brute force produces
  answer → Solution is compared

## AI Language Model Tools

Two tools registered for GitHub Copilot/AI assistants:

1. `run_test_cases`: Execute test cases (parameter: `idx` for specific Tc or
   omit for all)
2. `read_problem_file`: Read Tc files (parameters: `fileType` enum, `idx` for Tc
   number)

See `src/ai/llmTcRunner.ts` and `src/ai/llmFileReader.ts` for implementations.

## Common Gotchas

- **fish shell**: Pre-commit scripts use Node, but terminal commands run in
  fish - avoid bash heredocs, use `printf` or `echo`
- **Path templates**: Settings use template syntax like `${workspace}`,
  `${dirname}`, `${basename}` - see `src/utils/strTemplate.ts`
- **Tc ordering**: Always iterate via `problem.tcOrder[]` not
  `Object.keys(problem.tcs)` - order is user-defined
- **Cache directory**: Configurable via `cph-ng.cache.directory` (default:
  `${tmp}/cph-ng`), cleaned on startup if `cleanOnStartup` enabled
- **Context updates**: Call `ProblemsManager.dataRefresh()` after modifying
  problems to update sidebar and VSCode context keys

## Testing & Debugging

No automated tests currently exist. Manual testing workflow:

1. Start watch mode: `pnpm run watch`
2. Press F5 to open Extension Development Host
3. Open a source file and use Ctrl+Alt+B to create/run problems
4. Check "CPH-NG" output channels for logs (one per module)
5. Webview debugging: Right-click sidebar → Inspect Element

## Configuration Philosophy

Settings are heavily used for customization - see `package.json`
contributes.configuration for 30+ options. All accessed via static `Settings`
class with getter methods (e.g., `Settings.compilation.cppCompiler`).

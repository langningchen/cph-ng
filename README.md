# CPH NG

[简体中文](https://github.com/langningchen/cph-ng/blob/main/README.zh-CN.md) | English

> Quickly compile, run and judge competitive programming problems in VS Code.
> Automatically download testcases , or write & test your own problems.

This is the next generation of the
[Competitive Programming Helper](https://github.com/agrawal-d/cph).

## Features

- Automatic compilation with display for compilation errors.
- Intelligent judge with support for signals, timeouts and runtime errors.
- Works with Competitive Companion.
- Works locally for your own problems.
- Support for several languages.

## Comparison with CPH

| Feature                 | CPH                      | CPH-NG                   |
| ----------------------- | ------------------------ | ------------------------ |
| Automatic Compilation   | ✅                       | ✅                       |
| Intelligent Judge       | ✅                       | ✅                       |
| Competitive Companion   | ✅                       | ✅                       |
| Local Problem Support   | ✅                       | ✅                       |
| Language Support        | ✅ C/C++ and 8 others    | ⚠️ Only C/C++ and Java   |
| Auto-submit Integration | ✅ Codeforces and Kattis | ⚠️ Only Codeforces       |
| Load Local Testcases    | ❌                       | ✅                       |
| Supported Result        | ⚠️ Only 3                | ✅ AC and 10 others [^1] |
| Store Result and Time   | ❌                       | ✅                       |
| Cache compiled program  | ❌                       | ✅ [^2]                  |
| SPJ support             | ❌                       | ✅                       |
| Brute Force Compare     | ❌                       | ✅                       |

[^1]: They are: AC PC PE WA TLE OLE RE CE SE SK RJ

[^2]:
    CPH-NG calculates a hash of the current source code. If the hash matches the
    last one, it skips the compile process to emit the running time.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 or higher)
- [pnpm](https://pnpm.io/)
- [Visual Studio Code](https://code.visualstudio.com/)

### Local Development Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/langningchen/cph-ng.git
    cd cph-ng
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    ```

3. **Set up Git hooks** (for translation checking)

    ```bash
    pnpm run install-hooks
    ```

4. **Start development**

    ```bash
    pnpm run watch
    ```

5. **Open in VS Code**
    - Open the project folder in VS Code
    - Press `F5` to start debugging
    - A new Extension Development Host window will open with CPH-NG loaded

### Development Scripts

- **`pnpm run watch`** - Start development build with file watching
- **`pnpm run compile`** - Build for production
- **`pnpm run lint`** - Run ESLint
- **`pnpm run check-translations`** - Check translation completeness
- **`pnpm run install-hooks`** - Install Git pre-commit hooks
- **`pnpm run package`** - Package the extension as `.vsix`

### Project Structure

```
cph-ng/
├── src/                           # VS Code extension backend (TypeScript)
│   ├── extension.ts               # Extension entry point (activation)
│   ├── ai/                        # LLM helpers
│   │   ├── llmFileReader.ts       # Read files via LLM
│   │   └── llmTcRunner.ts         # Run test cases via LLM
│   ├── core/                      # Core judging pipeline
│   │   ├── checker.ts             # Output comparison / checker logic
│   │   ├── compiler.ts            # Compilation logic
│   │   └── runner.ts              # Test case execution
│   ├── module/                    # Feature modules
│   │   ├── companion.ts           # Competitive Companion integration
│   │   ├── cphCapable.ts          # CPH capability checks / helpers
│   │   ├── cphNg.ts               # CPH-NG core wiring
│   │   └── sidebarProvider.ts     # Sidebar (view) provider
│   └── utils/                     # Shared utilities
│       ├── embedded.ts            # Import/export embedded data
│       ├── folderChooser.ts       # Folder choosing strategies
│       ├── io.ts                  # Logging / filesystem helpers
│       ├── migration.ts           # Migration from old problem files
│       ├── result.ts              # Result types & helpers
│       ├── settings.ts            # Configuration management
│       ├── strTemplate.ts         # String templating utilities
│       ├── types.backend.ts       # Backend-only types
│       ├── types.ts               # Shared types
│       └── types/                 # Versioned problem schema definitions
│           ├── 0.0.1.ts
│           ├── 0.0.3.ts
│           ├── 0.0.4.ts
│           ├── 0.0.5.ts
│           └── 0.1.0.ts
├── webview/                       # React-based webview UI
│   ├── App.tsx                    # Main webview app
│   ├── msgs.ts                    # Message contracts between webview & ext
│   ├── styles.css                 # Webview styles
│   ├── utils.ts                   # Webview utilities
│   ├── vscode.d.ts                # VS Code API typings for webview
│   ├── components/                # React components
│   │   ├── acCongrats.tsx
│   │   ├── cphButton.tsx
│   │   ├── createProblemView.tsx
│   │   ├── noTcs.tsx
│   │   ├── problemActions.tsx
│   │   ├── problemTitle.tsx
│   │   ├── problemView.tsx
│   │   ├── tcDataView.tsx
│   │   ├── tcsView.tsx
│   │   ├── tcView.tsx
│   │   ├── tips.tsx
│   │   └── base/
│   │       ├── cphFlex.tsx
│   │       ├── cphLink.tsx
│   │       ├── cphText.tsx
│   │       └── errorBoundary.tsx
│   └── l10n/                      # Webview translations
│       ├── en.json
│       └── zh.json
├── l10n/                          # Extension runtime translations
│   └── bundle.l10n.zh-cn.json
├── res/                           # Static assets
│   ├── cph-ng.png
│   ├── panel-view-icon.svg
│   └── party.gif
├── scripts/                       # Dev scripts & git hooks
│   ├── commit-msg
│   ├── install-hooks.js
│   └── pre-commit
├── CHANGELOG.md
├── LICENSE
├── README.md
├── README.zh-CN.md
├── commitlint.config.js           # Commit linting rules
├── eslint.config.mjs              # ESLint config
├── package.json                   # Extension manifest & deps
├── package.nls.json               # Manifest translations (English)
├── package.nls.zh.json            # Manifest translations (Chinese)
├── pnpm-lock.yaml
├── tsconfig.json                  # TypeScript compiler options
└── webpack.config.mjs             # Build configuration
```

Key files:
- [src/extension.ts](src/extension.ts) — extension activation entry.
- [src/module/cphNg.ts](src/module/cphNg.ts) — CPH‑NG core wiring.
- [src/core/compiler.ts](src/core/compiler.ts), [src/core/runner.ts](src/core/runner.ts), [src/core/checker.ts](src/core/checker.ts) — compile/run/check pipeline.
- [webview/App.tsx](webview/App.tsx) — main React webview app.

### Translation Management

This project supports internationalization (i18n) with automatic translation
checking:

#### Adding New Translations

1. **Extension Configuration** (package.json)
    - Add `%key%` references in package.json
    - Add translations in `package.nls.json` (English)
    - Add translations in `package.nls.zh.json` (Chinese)

2. **Runtime Messages** (Extension code)
    - Use `vscode.l10n.t('key')` in TypeScript code
    - Add translations in `l10n/bundle.l10n.zh-cn.json`

3. **Webview UI** (React components)
    - Use `t('key')` in React components
    - Add translations in `src/webview/l10n/en.json` (English)
    - Add translations in `src/webview/l10n/zh.json` (Chinese)

#### Translation Checking

- **Automatic**: Pre-commit hook checks translation completeness
- **Manual**: Run `pnpm run check-translations`
- **Bypass**: Use `git commit --no-verify` (not recommended)

### Building and Packaging

1. **Development Build**

    ```bash
    pnpm run compile
    ```

2. **Create VSIX Package**

    ```bash
    pnpm run package
    ```

3. **Install Locally**
    ```bash
    code --install-extension cph-ng-*.vsix
    ```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and ensure translations are complete
4. Commit your changes (pre-commit hook will check translations)
5. Push to your branch: `git push origin feature/your-feature`
6. Create a Pull Request

### Debugging

- **Extension Host**: Press `F5` in VS Code to start debugging
- **Webview**: Open Chrome DevTools in the webview panel
- **Logs**: Check VS Code Output panel (CPH-NG channels)
- **Compilation**: Check Output panel (CPH-NG Compilation channel)

## License

This project is licensed under the terms of the
[GNU Affero General Public License v3.0](https://github.com/langningchen/cph-ng/blob/main/LICENSE).

## Known Issues

See [GitHub Issues](https://github.com/langningchen/cph-ng/issues).

## Change Log

See
[CHANGELOG.md](https://github.com/langningchen/cph-ng/blob/main/CHANGELOG.md)

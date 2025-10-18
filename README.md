# CPH-NG

[简体中文](https://github.com/langningchen/cph-ng/blob/main/README.zh-CN.md) | English

> Quickly compile, run and judge competitive programming problems in VS Code.
> Automatically download testcases, or write & test your own problems.

This is the next generation of the
[Competitive Programming Helper](https://github.com/agrawal-d/cph).

![](https://github.com/user-attachments/assets/b4c100c4-43e1-48e0-a0c0-02b7b45758ba)

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
| SPJ and interactive     | ❌                       | ✅                       |
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

This project is licensed under the terms of the [GNU Affero General Public License v3.0](https://github.com/langningchen/cph-ng/blob/main/LICENSE).

## Known Issues

See [GitHub Issues](https://github.com/langningchen/cph-ng/issues).

## Change Log

See
[CHANGELOG.md](https://github.com/langningchen/cph-ng/blob/main/CHANGELOG.md)

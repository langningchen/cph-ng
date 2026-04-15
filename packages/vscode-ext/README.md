# CPH-NG VS Code Extension

> Quickly compile, run and judge competitive programming problems in VSCode.
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
| Language Support        | ✅ C/C++ and 8 others    | ⚠️ Only common [^1]      |
| Auto-submit Integration | ✅ Codeforces and Kattis | ✅ 4 platforms [^2]       |
| Load Local Testcases    | ❌                       | ✅                       |
| Supported Result        | ⚠️ Only 3                | ✅ AC and 10 others [^3] |
| Store Result and Time   | ❌                       | ✅                       |
| Cache compiled program  | ❌                       | ✅ [^4]                  |
| SPJ and interactive     | ❌                       | ✅                       |
| Stress Test             | ❌                       | ✅                       |

[^1]: CPH-NG supports C/C++, Java, Python, JavaScript, Rust

[^2]: CPH-NG Submit supports Codeforces, AtCoder, Luogu and Hydro. More platforms will be added in future updates.

[^3]: They are: AC PC PE WA TLE OLE RE CE SE SK RJ

[^4]:
    CPH-NG calculates a hash of the current source code. If the hash matches the
    last one, it skips the compile process to emit the running time.

## License

This project is licensed under the terms of the [GNU Affero General Public License v3.0](https://github.com/langningchen/cph-ng/blob/main/LICENSE).

## Known Issues

See [GitHub Issues](https://github.com/langningchen/cph-ng/issues).

## Change Log

See [CHANGELOG.md](https://github.com/langningchen/cph-ng/blob/main/CHANGELOG.md)

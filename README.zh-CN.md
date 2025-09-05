# CPH NG

简体中文 | [English](https://github.com/langningchen/cph-ng/blob/main/README.md)

![](https://vsmarketplacebadges.dev/version-short/langningchen.cph-ng.svg) ![](https://vsmarketplacebadges.dev/installs/langningchen.cph-ng.svg) ![](https://vsmarketplacebadges.dev/downloads/langningchen.cph-ng.svg) ![](https://vsmarketplacebadges.dev/rating-star/langningchen.cph-ng.svg)

> [!WARNING]
> 这个扩展正在开发中，可能存在 bug、功能不完整和不事先通知的重大变更。

> 在 VS Code 中快速编译、运行和评测编程竞赛题目。可自动下载测试用例，或编写和测试自己的题目。

这是 [Competitive Programming Helper](https://github.com/agrawal-d/cph) 的下一代版本。

## 功能特性

- 自动编译并显示编译错误。
- 智能评测，支持信号、超时和运行时错误。
- 与 Competitive Companion 协同工作。
- 可本地处理自己的题目。
- 支持多种语言。

## 与 CPH 的对比

| 功能特性              | CPH                      | CPH-NG                  |
| :-------------------- | :----------------------- | :---------------------- |
| 自动编译              | ✅                       | ✅                      |
| 智能评测              | ✅                       | ✅                      |
| Competitive Companion | ✅                       | ✅                      |
| 本地题目支持          | ✅                       | ✅                      |
| 语言支持              | ✅ C/C++ 和其他 8 种语言 | ⚠️ 仅 C/C++ 和 Java     |
| 自动提交集成          | ✅ Codeforces 和 Kattis  | ⚠️ 仅 Codeforces        |
| 加载本地测试用例      | ❌                       | ✅                      |
| 支持的评测结果        | ⚠️ 仅 3 种               | ✅ AC 和其他 10 种 [^1] |
| 存储评测结果和时间    | ❌                       | ✅                      |
| 缓存已编译程序        | ❌                       | ✅ [^2]                 |
| SPJ 支持              | ❌                       | ✅                      |
| 暴力对比              | ❌                       | ✅                      |

[^1]: 它们是：AC PC PE WA TLE OLE RE CE SE SK RJ

[^2]:
    CPH-NG 会计算当前源代码的哈希值。如果哈希值与上次匹配，则跳过编译过程，以减少运行时间。

## 开发

### 先决条件

- [Node.js](https://nodejs.org/) (v22 或更高版本)
- [pnpm](https://pnpm.io/)
- [Visual Studio Code](https://code.visualstudio.com/)

### 本地开发设置

1.  **克隆仓库**

    ```bash
    git clone https://github.com/langningchen/cph-ng.git
    cd cph-ng
    ```

2.  **安装依赖**

    ```bash
    pnpm install
    ```

3.  **设置 Git 钩子** (用于检查翻译)

    ```bash
    pnpm run install-hooks
    ```

4.  **开始开发**

    ```bash
    pnpm run watch
    ```

5.  **在 VS Code 中打开**
    - 在 VS Code 中打开项目文件夹
    - 按 `F5` 开始调试
    - 将会打开一个加载了 CPH-NG 的新扩展开发主机窗口

### 开发脚本

- **`pnpm run watch`** - 启动开发构建并监控文件变化
- **`pnpm run compile`** - 进行生产构建
- **`pnpm run lint`** - 运行 ESLint
- **`pnpm run check-translations`** - 检查翻译完整性
- **`pnpm run install-hooks`** - 安装 Git 预提交钩子
- **`pnpm run package`** - 将扩展打包为 `.vsix` 文件

### 项目结构

```
cph-ng/
├── src/                    # 扩展源代码
│   ├── extension.ts        # 主扩展入口点
│   ├── cphNg.ts           # CPH-NG 核心功能
│   ├── compiler.ts        # 编译逻辑
│   ├── runner.ts          # 测试用例执行
│   └── webview/           # React webview 组件
│       ├── App.tsx        # 主 webview 应用
│       ├── components/    # React 组件
│       └── l10n/          # Webview 翻译
├── l10n/                  # 扩展运行时翻译
├── scripts/               # 开发脚本和钩子
├── package.json           # 扩展清单和依赖
├── package.nls.json       # 配置翻译 (英文)
├── package.nls.zh.json    # 配置翻译 (中文)
└── webpack.config.mjs     # 构建配置
```

### 翻译管理

本项目支持国际化 (i18n)，并带有自动翻译检查功能：

#### 添加新翻译

1.  **扩展配置** (package.json)
    - 在 package.json 中添加 `%key%` 引用
    - 在 `package.nls.json` 中添加翻译 (英文)
    - 在 `package.nls.zh.json` 中添加翻译 (中文)

2.  **运行时消息** (扩展代码)
    - 在 TypeScript 代码中使用 `vscode.l10n.t('key')`
    - 在 `l10n/bundle.l10n.zh-cn.json` 中添加翻译

3.  **Webview UI** (React 组件)
    - 在 React 组件中使用 `t('key')`
    - 在 `src/webview/l10n/en.json` 中添加翻译 (英文)
    - 在 `src/webview/l10n/zh.json` 中添加翻译 (中文)

#### 翻译检查

- **自动**：预提交钩子会检查翻译完整性
- **手动**：运行 `pnpm run check-translations`
- **绕过**：使用 `git commit --no-verify` (不推荐)

### 构建和打包

1.  **开发构建**

    ```bash
    pnpm run compile
    ```

2.  **创建 VSIX 包**

    ```bash
    pnpm run package
    ```

3.  **本地安装**
    ```bash
    code --install-extension cph-ng-*.vsix
    ```

### 贡献

1.  Fork 仓库
2.  创建一个功能分支：`git checkout -b feature/your-feature`
3.  进行修改并确保翻译完整
4.  提交你的修改 (预提交钩子会检查翻译)
5.  推送到你的分支：`git push origin feature/your-feature`
6.  创建一个 Pull Request

### 调试

- **扩展主机**：在 VS Code 中按 `F5` 开始调试
- **Webview**：在 webview 面板中打开 Chrome DevTools
- **日志**：查看 VS Code 输出面板 (CPH-NG 通道)
- **编译**：查看输出面板 (CPH-NG 编译通道)

<!-- prettier-ignore-start -->
## 许可证

本项目遵循 [GNU Affero General Public License v3.0](https://github.com/langningchen/cph-ng/blob/main/LICENSE) 许可协议。

## 已知问题

请参阅 [GitHub Issues](https://github.com/langningchen/cph-ng/issues)。

## 更新日志

请参阅 [CHANGELOG.md](https://github.com/langningchen/cph-ng/blob/main/CHANGELOG.md)。
<!-- prettier-ignore-end -->

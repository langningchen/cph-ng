# 跨平台构建与发布

独立 CLI / RPC 内核共用 `cph-ng-judge` 二进制，按操作系统和 CPU 架构分别构建。仓库现在有独立的 `Judge kernel release` 工作流（`.github/workflows/judge-kernel-release.yml`），无需在开发机安装全部交叉编译工具链。

## 支持的发布目标

目标列表维护在 [`scripts/release-targets.json`](../scripts/release-targets.json)，工作流从该文件生成原生构建矩阵。

| 用户平台 | Rust target | GitHub runner | 下载格式 |
| --- | --- | --- | --- |
| Linux x64 | `x86_64-unknown-linux-gnu` | `ubuntu-22.04` | `.tar.gz` |
| Linux ARM64 | `aarch64-unknown-linux-gnu` | `ubuntu-22.04-arm` | `.tar.gz` |
| Windows x64 | `x86_64-pc-windows-msvc` | `windows-2022` | `.zip` |
| macOS Intel | `x86_64-apple-darwin` | `macos-15-intel` | `.tar.gz` |
| macOS Apple Silicon | `aarch64-apple-darwin` | `macos-14` | `.tar.gz` |

这些是 GitHub 当前支持的原生 runner 标签。macOS 的 `-latest` 标签目前对应 ARM64，不能用单个 macOS 构建代替两种架构。[GitHub runner 列表](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

Linux 官方工作流以 Ubuntu 22.04 的 GNU/glibc 环境构建，面向 glibc 2.35 及以上环境；Alpine/musl 和 Windows ARM64 不在此矩阵中。本地构建的 Linux 产物依赖本机的 glibc，不能直接假定具有官方工作流的兼容基线。Windows 发布任务使用 MSVC，并启用 `-C target-feature=+crt-static` 静态链接 C 运行时。[Rust C 运行时链接说明](https://doc.rust-lang.org/reference/linkage.html#static-and-dynamic-c-runtimes)

当前脚本生成未做 Developer ID / Authenticode 签名的命令行归档；没有配置代码签名或 macOS notarization 凭据。签名若以后接入，应在归档和计算校验和之前完成。

## 先构建，不发布

1. 将代码和工作流提交到 GitHub。
2. 在 Actions 中选择 **Judge kernel release → Run workflow**，选择要构建的分支。
3. 工作流在五个平台运行 Rust 测试、CLI/RPC 集成测试、Clippy 和 release 构建。
4. 在该次运行的 Artifacts 中下载 `judge-cli-<target>`。手动运行工作流不会创建 GitHub Release。

每个 artifact 包含独立下载归档和对应的 `.sha256` 文件。归档里有二进制、README、CLI/RPC/发布文档、示例配置、LICENSE 和 `build-info.json`；构建信息记录源码提交、工作区是否有未提交改动、Rust/Cargo 版本和二进制 SHA-256。压缩文件保留 Unix 可执行权限。

## 正式发布

内核版本以 `packages/judge-kernel/Cargo.toml` 的 `[package].version` 为准，使用独立标签 `judge-kernel-v<版本>`。VSIX 的版本由 `.cph-ng-release.json` 管理，两者独立；例如当前内核为 0.7.8、VSIX 为 0.7.11。不要用 VSIX 版本给不同版本的内核归档改名。

发布新版本时，先修改内核 Cargo.toml 的版本，在 `packages/judge-kernel` 中执行 `cargo check -p cph-ng-judge` 更新仓库根目录 Cargo.lock，然后提交代码和这两个文件。确认提交已推送后，为同一个提交创建并推送匹配的标签，例如：

```sh
# 仅当 Cargo.toml 中的版本已经是 0.7.9 时执行
# 在待发布提交上操作；这里不会自动修改版本号
git tag judge-kernel-v0.7.9
git push origin judge-kernel-v0.7.9
```

标签触发后，构建和打包命令不需要输入确认。版本与标签不匹配会在构建前失败；任一平台测试/构建失败都不会进入发布任务。全部通过后，工作流核对五套归档与校验和，生成 `SHA256SUMS`，再创建 GitHub Release。含预发布标识的 Cargo 版本会标记为 prerelease；组件发布不会改变整个仓库的 Latest Release。

发布使用工作流自带的 `GITHUB_TOKEN`，仅 publish job 请求 `contents: write`，并沿用仓库原有的 `production` 发布环境。仓库的 Actions 权限、分支/标签规则和环境保护规则仍需允许相应操作；如果 `production` 已配置人工审核，发布任务仍遵守该规则。工作流通过 `gh release create --verify-tag` 使用已存在的标签，不自动创建或覆盖版本标签，也不覆盖已有 Release；失败重跑若遇到已有 Release，应先检查该 Release 的状态。[GitHub CLI 发布参数](https://cli.github.com/manual/gh_release_create)

归档名称示例：

```text
cph-ng-judge-0.7.9-x86_64-unknown-linux-gnu.tar.gz
cph-ng-judge-0.7.9-aarch64-unknown-linux-gnu.tar.gz
cph-ng-judge-0.7.9-x86_64-pc-windows-msvc.zip
cph-ng-judge-0.7.9-x86_64-apple-darwin.tar.gz
cph-ng-judge-0.7.9-aarch64-apple-darwin.tar.gz
SHA256SUMS
```

Windows 用户下载 `.exe` 所在的 zip；Linux/macOS 解压后将可执行文件加入 PATH。使用前按下载的 `.sha256` 或 `SHA256SUMS` 校验归档。

```sh
# Linux
sha256sum -c cph-ng-judge-0.7.9-x86_64-unknown-linux-gnu.tar.gz.sha256
# macOS
shasum -a 256 -c cph-ng-judge-0.7.9-aarch64-apple-darwin.tar.gz.sha256
```

```powershell
# Windows：将结果与同名 .sha256 文件比较
Get-FileHash .\cph-ng-judge-0.7.9-x86_64-pc-windows-msvc.zip -Algorithm SHA256
```

## 本机构建与打包

项目使用 stable Rust，不需要 nightly 特性。Cargo.lock 固定依赖版本；若要求固定编译器版本，可进一步把 `rust-toolchain.toml` 的 channel 从 stable 固定为已验证的具体版本。归档记录实际使用的工具链，不声称浮动 stable 的不同版本会生成相同二进制。

在对应原生系统、`packages/judge-kernel` 目录执行，例如 Linux x64：

```sh
rustup target add x86_64-unknown-linux-gnu
cargo test --locked -p cph-ng-judge --target x86_64-unknown-linux-gnu
cargo build --release --locked -p cph-ng-judge --target x86_64-unknown-linux-gnu
python3 scripts/release.py package --target x86_64-unknown-linux-gnu \
  --binary ../../target/x86_64-unknown-linux-gnu/release/cph-ng-judge \
  --output-dir dist
python3 scripts/release.py checksums --output-dir dist
```

Windows 使用 `python` 和 `.exe`，并按工作流设置 `RUSTFLAGS=-C target-feature=+crt-static`。打包脚本仅依赖 Python 3.11+ 标准库；`--output-dir` 只决定输出位置，不执行上传。

`rustup target add` 只安装目标平台的 Rust 标准库，不能代替目标系统链接器和 SQLite 等 C 依赖所需的工具链。当前流程选择原生 runner，并在每个平台实际执行测试；本地 Linux 编译成功不能证明 Windows/macOS 二进制可用。发布包不包含 g++/gcc、Python、Node、Rust 或 JDK，最终用户仍需为所评测的语言安装对应工具链。

VSIX 继续由原有 CI 构建/发布；独立内核工作流不调用 Marketplace/Open VSX 发布，也不修改扩展版本。原有 CI 同样收集五个平台的内核，打包阶段设置 `CPH_NG_KERNEL_PREBUILT=1`，检查五套产物是否齐全并直接使用，避免在打包机器上重新编译、改变 Linux 兼容基线。本地默认仍只构建当前系统的内核。

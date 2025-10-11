# 配置参考

CPH-NG 所有配置设置的完整参考，按类别组织。

## 设置类别

CPH-NG 提供 10 个类别的设置来自定义行为：

### [基本设置](basic.md)
常规扩展行为和 UI 偏好设置。

- `cph-ng.basic.folderOpener` - 文件夹选择方法

### [编译设置](compilation.md)
C、C++ 和 Java 的编译器配置。

- 编译器路径和参数
- 编译超时
- 包装器和钩子支持

### [运行器设置](runner.md)
程序执行和资源测量。

- 时间附加和阈值
- 输出大小限制
- 用于内存跟踪的高级运行器

### [比较设置](comparing.md)
输出比较和判定结果确定。

- 输出限制超限阈值
- 格式错误处理
- 错误输出行为

### [暴力对拍设置](brute-force.md)
暴力对拍功能的设置。

- 生成器时间限制
- 暴力解法超时

### [问题设置](problem.md)
问题文件管理和默认值。

- 默认时间和内存限制
- 文件路径模板
- 模板文件位置
- 测试用例加载行为

### [缓存设置](cache.md)
编译缓存和临时文件。

- 缓存目录位置
- 清理行为

### [CPH 兼容性设置](cph-compat.md)
与原始 CPH 扩展的集成。

- 导入兼容性选项

### [Competitive Companion 设置](companion.md)
浏览器扩展集成设置。

- 监听端口配置
- 文件命名约定
- 自动导入行为
- 特定平台选项

### [侧边栏设置](sidebar.md)
CPH-NG 面板的 UI 自定义。

- 主题和颜色
- 状态显示选项
- 字体自定义
- 动画偏好

## 快速参考

### 路径变量

许多设置支持模板变量以实现灵活的路径配置：

| 变量 | 描述 | 示例 |
|------|------|------|
| `${workspace}` | 工作区根目录 | `/home/user/project` |
| `${tmp}` | 系统临时目录 | `/tmp` |
| `${home}` | 用户主目录 | `/home/user` |
| `${dirname}` | 文件目录 | `/home/user/project/src` |
| `${relativeDirname}` | 相对目录 | `src` |
| `${basename}` | 带扩展名的文件名 | `main.cpp` |
| `${basenameNoExt}` | 不带扩展名的文件名 | `main` |
| `${extname}` | 文件扩展名 | `.cpp` |

### 设置访问

**VS Code UI：**
1. 按 `Ctrl+,`（Windows/Linux）或 `Cmd+,`（macOS）
2. 搜索"cph-ng"
3. 浏览和修改设置

**settings.json：**
```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.compilation.cppArgs": "-O2 -std=c++20 -Wall"
}
```

## 配置示例

### 竞争性编程设置

```json
{
  "cph-ng.problem.defaultTimeLimit": 2000,
  "cph-ng.problem.defaultMemoryLimit": 256,
  "cph-ng.compilation.cppArgs": "-O2 -std=c++17 -Wall",
  "cph-ng.companion.shortCodeforcesName": true,
  "cph-ng.comparing.regardPEAsAC": false
}
```

### 调试配置

```json
{
  "cph-ng.compilation.cppArgs": "-g -O0 -std=c++20 -Wall -fsanitize=address",
  "cph-ng.runner.useRunner": true,
  "cph-ng.comparing.ignoreError": false
}
```

### 性能优化

```json
{
  "cph-ng.cache.cleanOnStartup": false,
  "cph-ng.compilation.timeout": 5000,
  "cph-ng.runner.timeAddition": 500
}
```

## 源代码参考

设置定义在：`src/modules/settings.ts`

每个设置类别都有一个对应的类：
- `BasicSection`（第 45 行）
- `CompilationSection`（第 54 行）
- `RunnerSection`（第 158 行）
- `ComparingSection`（第 176 行）
- `BFCompareSection`（第 191 行）
- `ProblemSection`（第 203 行）
- `CacheSection`（第 96 行）
- `CphCapableSection`（第 113 行）
- `CompanionSection`（第 122 行）
- `SidebarSection`（第 245 行）

Package.json 贡献：`package.json` 第 113-520 行

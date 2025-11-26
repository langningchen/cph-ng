你可以使用 JavaScript 编写脚本以实现完全用户自定义可配置的样例导入设置，编写的脚本保存后，通过设置 `cph-ng.companion.customPathScript` 指定其路径。

## 开始

你的脚本应该有如下结构：

```javascript
const process = async () => {
    /* -- your code -- */
    return results;
};
```

其中返回值的意义见下文。

## 全局变量

你的脚本的运行环境中将会有如下全局变量作为传参：

- **problems** ：类型 `CompanionProblem[]` ，每一项代表一个题目，`CompanionProblem` 一些可能有用的字段定义如下：
  - **name**：类型 `string`，题目的全名，这可能包含人类可读的名称。
  - **group**：类型 `string`，题目所属的分类，格式为 `<OJ名称> - <分类>`，如果分类不存在，连字符会被省略。一些常见 OJ 的字段值如下：
    - `luogu`：值恒为 `Luogu`，即使是 `Remote Judge` 题库。
    - `atcoder`：值为 `Atcoder - <比赛名称>`，如 `AtCoder - AtCoder Beginner Contest 433`。
    - `codeforces`：值为 `Codeforces - <比赛名称>`，如 `Codeforces - Educational Codeforces Round 184 (Rated for Div. 2)`。
    - `vjudge`：值为 `Virtual Judge - <比赛名称>` 或 `Virtual Judge - <题库>`，如 `Virtual Judge - 数论杂题（div1）`或 `Virtual Judge - %E6%B4%9B%E8%B0%B7`（`%E6%B4%9B%E8%B0%B7`解码后为 `洛谷`）
  - **url**：类型 `string`，题目在 OJ 上的完整链接。
  - **interactive**：类型 `boolean`，是否为交互题。

- **workspaceFolders** ：类型 `WorkspaceFolderCtx[] | undefined`，使用时注意判断 `undefined` 和列表为空的情况，判断后可使用 `workspaceFolders[0].path` 获取工作区根目录的绝对路径。

## 返回值

`process` 函数应当返回 `(string | null)[]` 类型，长度与 `problems` 相同，与题目一一对应，表示题目的存储位置，必须使用绝对路径。某一个位置为 `null` 说明处理该题目的时候出现了错误，或无法得到其位置。

## 工具函数 / 工具类

出于安全考量，不建议在脚本中引入依赖，运行环境中已有如下工具函数 / 工具类：

- **URL**：即 `URL` 类。
- **path**：精简版的 `path` 库，包含 `join`、`basename`、`dirname`、`extname`、`sep`、`normalize`、`isAbsolute`、`parse`、`format`。
- **fs**：精简版的 `fs` 库，包含 `existsSync`。
- **utils**：包含 `sanitize: (name: string) => string` 函数，将文件名中不允许的字符替换为下划线。
- **logger**：包含 `trace`、`debug`、`info`、`warn`、`error` 的日志类，你可以在下方面板 `输出`选项卡并选择`CPH-NG 用户脚本`来查看日志。
- **ui**：包含简单的 ui 交互功能，具体如下：
  - `chooseFolder: (title?: string) => Promise<string | undefined>`：让用户选择一个目录。
  - `chooseItem: (items: string[], placeholder?: string) => Promise<string | undefined>`：让用户在多个选项中选择一个。
  - `input: (prompt?: string, value?: string) => Promise<string | undefined>`：让用户输入一个字符串。

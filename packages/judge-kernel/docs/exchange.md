# 题目共享、导入导出与源码身份

题目和源码是两个实体。一个 `problem_id` 拥有题名、链接、样例顺序及内容、资源限制、checker、interactor、对拍配置和题目 TOML。每份关联源码拥有独立 `code_id`；任务和运行历史同时记录两个 ID。修改共享题目的样例或标准会作用于所有关联源码，已经完成的历史保留当时的结果、源码快照和配置快照。

```sh
cph-ng-judge problem create main.cpp --name 'A + B'
cph-ng-judge testcase add main.cpp --input-text '1 2' --answer-text '3'
cph-ng-judge problem link main.cpp --destination alternative.cpp
cph-ng-judge problem sources main.cpp
cph-ng-judge run alternative.cpp
cph-ng-judge history list alternative.cpp
cph-ng-judge history list --code-id SOURCE_UUID
cph-ng-judge history list --problem-id PROBLEM_UUID
```

`alternative.cpp` 必须已经存在。`link` 为它建立新的源码身份；`history list SOURCE` / `--code-id` 只查该源码，`--problem-id` 明确汇总整题所有源码的历史。不指定引用时查询整个 store。删除题目会删除它的全部源码关联和测试数据，保留实际源码和独立历史记录。

## 格式与损失确认

所有导出格式都有匹配的导入。`export` 与 `problem export` 等价，`import` 与 `problem import` 等价。默认导出原生格式；兼容格式需要用 `--export-format` 指定，输出文件名不决定转换格式。

| 格式 | 建议扩展名 | 可以携带的内容 | 与原生包相比的损失 |
| --- | --- | --- | --- |
| `native` | `.cph` | 题目元数据、样例及顺序、所有关联源码、辅助程序内容、配置、每份源码的完整已完成历史 | 不丢弃该题目的上述持久数据；导入时重映射本地 ID 和文件位置 |
| `companion` | `.json` | 题名、URL、资源限制、输入与答案 | 源码和辅助程序、稳定身份、配置、历史 |
| `prob` | `.prob` | 旧 CPH JSON；题名、URL、资源限制、输入与答案、原源码路径 | 稳定 UUID、源码/辅助程序内容、配置、历史；UUID 测试点转换为数字序号 |
| `bin` | `.bin` | 旧 CPH-NG gzip JSON；题名、URL、限制、测试点 UUID/顺序/内容、源码与辅助程序路径 | 源码内容及关联、题目/源码 ID、内核配置、历史；辅助文件路径依赖原机器 |

先预览再决定是否接受有损转换：

```sh
cph-ng-judge export main.cpp --destination problem.json --export-format companion --dry-run
cph-ng-judge export main.cpp --destination problem.json --export-format companion --force
cph-ng-judge import problem.json --source another.cpp

cph-ng-judge export main.cpp --destination problem.prob --export-format prob --force
cph-ng-judge import problem.prob --source another.cpp

cph-ng-judge export main.cpp --destination problem.bin --export-format bin --force
cph-ng-judge import problem.bin --source another.cpp
```

上述导入示例分别使用尚未登记的已有源码；同一源码不能重复导入为不同题目。兼容格式无法保存题目/源码身份，因此即使当前没有历史也需要 `--force`。返回结果中的 `losses` 列出此次转换损失；未确认时返回 Conflict / 退出码 2，不创建输出。`--force` 只接受格式损失，不覆盖文件、不放宽路径或大小限制。输出完整写好后才发布到指定的新文件。

导入自动识别 `.prob`、gzip `.bin`，其余按 JSON 的原生格式标识或 Companion 字段识别。`--import-format native|companion|prob|bin|auto` 可以明确选择；`legacy` 是按 `.prob/.bin` 扩展名选择旧导入器的兼容写法。Companion 需要 `--source`；旧格式可以用 `--source` 覆盖包内的本机源码路径，也可省略以使用旧文件中的路径。JSON 可以从 stdin 输入：

```sh
cat problem.json | cph-ng-judge import - --source another.cpp
```

## 原生包

```sh
cph-ng-judge export main.cpp --destination problem.cph
cph-ng-judge import problem.cph --destination ./received
cat problem.cph | cph-ng-judge import - --destination ./received-again
```

原生包是可检查、可版本化的 UTF-8 JSON，顶层 `format: "cph-ng"`、`version: 1`。包含 `problem`、内联 `testcases`、`sources`、`auxiliary`、`config_toml`、`effective_config`、`imported_config_toml` 、`history` 和 `origins`。运行历史包含完整 TaskInfo、判定详情、源码和有效配置快照。运行缓存、编译产物、活动任务队列、事件重放日志以及 VS Code UI 偏好不属于题目共享包。

`--destination` 必须是尚不存在的目录，父目录必须存在。导入不写包内记录的绝对路径：它在新目录下为源码及辅助程序创建独立子目录，再更新内核中的引用。源文件与辅助程序仅提取，不执行；题目、源码与运行记录使用新 ID，包内的共享关系和历史归属同步更新。题目测试点 UUID 在新题目命名空间内保留。原始与新题目、源码、运行 ID 的映射记录在 `import-origins.json`，后续原生导出继续携带该来源链，保留共享来源与身份对应关系。导入失败会清理此次创建的目录和题目；已有题目、源文件和历史不会被覆盖。

导入把导出时的有效配置固定为新题目的配置，使机器上不同的全局比较设置不会悄悄改变测试标准。原始题目 TOML 原文保存在该题目目录的 `imported-config.toml`，再次导出会包含它。目标进程显式设置的 `CPH_` 环境变量仍具有最高优先级。工具链可执行路径也被保留，换机器后可在内核设置中调整。包只收录内核登记的源码和辅助文件，不打包工具链、系统库或工程中未登记的依赖文件。

单份源码最多 16 MiB，每题测试输入与答案总量最多 16 MiB；原生 JSON 文件或 stdin 输入最多 128 MiB，最多 256 份关联源码。`.prob/.bin` 导出遵守旧导入器 16 MiB 的 JSON/解压限制，超限时即使指定 `--force` 也失败，避免生成无法重新导入的文件。未知版本、重复身份、缺失的辅助程序或不一致的测试顺序会在创建目录前被拒绝。

## 复制、移动和索引

xattr/NTFS ADS 是定位线索，不能证明“这是同一份源码”。例如 GNU `cp -a` 可以保留扩展属性，复制得到相同 marker 是正常情况。[GNU cp 文档](https://www.gnu.org/software/coreutils/manual/html_node/cp-invocation.html)

解析顺序是已登记的规范路径、设备/inode（Windows 为 volume/file ID）、marker、内容哈希：

- 已登记路径继续保持身份，兼容编辑器使用临时文件原子替换保存。
- 在其他路径发现候选时，只有唯一候选且原路径已不存在，才自动按移动恢复同一源码 ID。
- 原路径仍存在，即使副本具有相同 marker、相同内容或是硬链接，也返回 Conflict；不改走原文件索引，不复制历史。
- 多个候选仍返回 Conflict；未命中返回 NotIndexed。两个内容相同的独立源文件可以显式 `problem create`，也可以显式 `problem link`。

硬链接共享同一个文件和 xattr，不能作为两份独立源码登记。符号链接规范化后指向同一份源码。普通复制可能保留或丢弃 xattr；两种情况都不会自动创建共享关系。唯一内容哈希加上“原路径已消失”仍只是恢复启发式，不能从文件系统证明人的复制/移动意图；需要消除歧义时使用显式命令。

```sh
# 建立共享关系，副本获得新 code_id
cph-ng-judge problem link main.cpp --destination copy.cpp
# 建立独立题目，样例与历史都独立
cph-ng-judge problem create independent.cpp
# 移动一份关联源码，保留它的 code_id 与历史
cph-ng-judge problem move copy.cpp --destination renamed.cpp
# 外部移动后，明确选择需要重新绑定的源码
cph-ng-judge problem move --code-id SOURCE_UUID --destination renamed.cpp --rebind-only
```

升级已有环境前，应正常停止旧常驻内核（RPC `system.shutdown`），更新二进制/VSIX 后再重新连接；避免旧进程继续使用旧表写入。

SQLite schema 2 引入 `source_index(code_id, problem_id, ...)`。旧单源码记录迁移为 `code_id = 原 problem_id`，旧 tasks/history 补入相同 `code_id`；原数据不会被新关联源码继承。旧 `problem_index` 仅保留用于迁移兼容，正常读写使用新表。

## fish TAB 补全

补全由 `clap_complete` 的命令树和动态值适配器共同提供，包含多级子命令、别名、长短选项、枚举值、路径和实时 ID。[clap_complete 动态补全文档](https://docs.rs/clap_complete/latest/clap_complete/env/index.html)

在 fish 中安装：

```fish
mkdir -p ~/.config/fish/completions
cph-ng-judge completions fish > ~/.config/fish/completions/cph-ng-judge.fish
source ~/.config/fish/completions/cph-ng-judge.fish
```

然后在下列命令末尾按 TAB：

```fish
cph-ng-judge tc
cph-ng-judge r main.cpp --testcase-id
cph-ng-judge tc delete main.cpp -t
cph-ng-judge r --problem-id
cph-ng-judge r --code-id
cph-ng-judge task cancel
cph-ng-judge history load
cph-ng-judge export main.cpp --export-format
```

样例 ID 根据已输入的源码路径、problem_id 或 code_id 限定到当前题目，并显示样例序号和题名；支持 UUID 前缀、`--testcase-id=...`、逗号分隔和重复 `-t`，排除已经选中的 ID。task_id 建议优先显示活动任务；run_id 来自已保存历史。`tc` 与 `r` 是命令别名，不必另写 fish function。

补全遵循命令中的 `--store-root`，其次是 `CPH_STORE_ROOT` 和默认目录；要补全插件中的题目，需要使用插件设置页显示的同一 store。源码路径包含空格时照常引用。查询以只读方式连接现有 SQLite，不创建或迁移 store、不读写 xattr、不重建索引、不启动 daemon；每类最多 200 个匹配 ID，总查询限时 200 ms。缺失、占用、旧 schema 或损坏的 store 不向终端输出错误，命令、选项和路径补全继续可用。移动但尚未重新登记的源码可改用 problem_id/code_id。

也支持 `completions bash|zsh|elvish|powershell`；这些 shell 使用同一命令树和 ID 查询。若只需要结构补全，可生成 `completions fish --static`。升级 CLI 后重新生成脚本，动态 shell 适配 API 随依赖升级可能变化。fish 按命令名从 completions 目录加载脚本；自定义 `XDG_CONFIG_HOME` 时使用相应 fish 目录。[fish 补全文档](https://fishshell.com/docs/current/completions.html)

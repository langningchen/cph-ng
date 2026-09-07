# CLI presentation design

This refactor follows the requested weighting: [Vercel cli-ux](https://github.com/vercel/vercel/blob/main/packages/cli/.agents/skills/cli-ux/SKILL.md) (60%) for human presentation, [create-cli](https://github.com/steipete/agent-scripts/blob/main/skills/create-cli/SKILL.md) (25%) for commands/help and Unix conventions, and [agent-native-design](https://github.com/Agents365-ai/agent-native-design/blob/main/skills/agent-native-design/SKILL.md) (15%) for predictable automation.

The user job is to judge a solution, scan failures, and inspect the relevant problem or run without fighting terminal wrapping. Previously final tables ignored terminal width, previews counted Unicode scalar values, and usage failures gained a redundant error wrapper. Success means readable results at 40, 80, and 140 columns, safe Unicode and ANSI handling, and unchanged JSON envelopes, command aliases, and exit-code meanings.

Compatibility takes priority over upstream product-specific defaults. Human results continue to use stdout; JSON and JSONL remain explicit. We do not change the store location, introduce prompts, rename `--output`, impose Vercel's deployment glyphs on judge verdicts, or migrate machine envelopes. The existing capabilities, pagination, task events, idempotency keys, and RPC schema remain the discovery and automation interfaces.

## Layout and styling

- `output/terminal/layout.rs` owns display-cell measurement, grapheme-safe ellipsis truncation, wrapping, and aligned detail fields. A synchronous rendering scope shares one width through nested records and restores it afterward.
- `output/terminal/table.rs` owns borderless tables, numeric alignment, width allocation, and the labeled-record fallback. It keeps cells on one line and prioritizes available space over fixed padding. A truncation hint points to `--json` or `--plain`.
- Judge progress reserves the first line for its phase and pass count from the first frame; completion replaces that summary instead of inserting a new line. Queued/running cases use typed states and no synthetic Judge row. Live and final tables share their column breakpoints. Judge results keep the verdict and pass count first. Below 64 columns, notes move below the table; below 38 columns, the table keeps case and verdict. Resource lists below 60 columns become labeled records.
- Detail views use a shared 16-column label area when it fits, and labels above values when it does not. URLs are underlined cyan, with a 256-color cyan on terminals that advertise support.
- Headings use bold/underline, primary values use bold, metadata uses dim, and recovery hints use dim/italic. Verdict colors retain their existing meanings. Every verdict also has a textual label.
- Table headings retain sentence case and familiar acronyms. Underlines cover column padding with one unstyled space between columns. Toolchain versions use neutral text; Python/Node compilation roles read `Syntax check` in human output while JSON retains `compiler`.
- `output/terminal/names.rs` maps protocol identifiers to human labels across toolchains, task/history lists, event phases, capabilities, exports and generic details. For example, `cpp` becomes `C++`, `judge.run` becomes `Judge solution`, and `spj` becomes `Special judge`. This applies to TTY and plain human views. JSON/JSONL, accepted flag values, completion tokens, TOML, UUIDs, executable names, paths and user-authored content retain their original spelling.
- Toolchain discovery ignores repeated PATH directories and directory symlinks while retaining the first invocation path. Distinct command names (such as `cc` and `gcc`) and distinct installations remain discoverable. Upstream versions exclude parenthesized vendor annotations; JSON retains the full description.
- Source binding lists show a shared problem ID once above the table. Human source paths mark missing files as `[Missing]`; other metadata failures read `[Unavailable]`. Availability is observed without changing stored paths or source identities. If the original source is not a readable regular file, the default source falls back to the oldest available binding (Code ID breaks ties). The original regains priority when restored; all-unavailable problems retain it for diagnostics. `problem list`, problem-ID operations and the `Primary` role agree on this selection. Explicit paths/Code IDs retain their meaning. JSON bindings expose the effective `role` alongside their stable IDs.
- Unsampled memory is `null` in new execution results, including interactive runs. Human tables show `N/A`, also for legacy zero-valued samples. Positive samples remain MiB values; this does not improve the sampling interval or claim exact peak measurement. See [memory accounting](memory-accounting.md) for current limitations and the platform-specific approach needed for exit-time statistics.
- Stress counterexamples label the actual failing seed as `Failing seed`; the JSON `seed` field and generation sequence remain unchanged.
- External control characters and bidirectional overrides are escaped before styling. CJK, combining marks, and emoji sequences are measured in terminal cells. Styles close at line boundaries.
- `COLUMNS` overrides detected width; invalid or zero values fall back to terminal detection, then 80 columns. Extremely narrow screens wrap safely; a grapheme wider than the entire screen uses a replacement glyph. JSON retains the original text.

## Modes and commands

| Control | Behavior |
| --- | --- |
| Default human, TTY | Responsive final output on stdout; live progress on stderr when both streams are terminals |
| Piped human | Unstyled text, without responsive truncation or live progress |
| `--plain` | Force the unstyled, unbounded text presentation even in a terminal |
| `--color auto\|always\|never` | Select human styles; explicit `always` overrides `NO_COLOR` on a capable TTY |
| `--no-color` | Alias in behavior for `--color never`; conflicts with an explicit color choice |
| `NO_COLOR` | Disable automatic color; cursor refresh can still operate |
| `TERM=dumb` | Disable styling and live progress; use plain results |
| `CI` | Disable live progress when nonempty, except `0` or `false` |
| `-q`, `--quiet` | Suppress progress while retaining final results |
| `--json`, `--output jsonl` | Preserve existing structured results/events and errors; never add ANSI, including with `--color always` |

`--plain` conflicts with explicit format selection. It is a human text view, not a versioned serialization format; scripts should use JSON/JSONL. Long values in tables and detail excerpts are available without truncation in plain mode. JSON is the path to complete business objects and raw program output.

Help puts common judging commands first, supplies action descriptions, groups related options, and includes stdin and machine-output examples. The existing command tree and aliases remain accepted. Parser errors retain clap's usage and suggestions without a second `Error: error:` prefix. A downstream pipe closing during final-result output exits quietly with the command's result status.

## Verification

The live PTY fixture also checks every redraw at 32/40/80/140 columns, including the summary position and final cursor cleanup. `CPH_LIVE_CAPTURE` saves those transcripts. The PTY fixture exercises 40/80/140-column help, usage errors, accepted/mixed results, and problem/testcase/history lists. It checks display widths, colors, plain mode, CI, `COLUMNS`, JSON/JSONL, and stdout redirected while stderr remains a TTY. Rust tests cover grapheme integrity, style resets, control-character escaping, and layouts down to one column.

To save actual ANSI transcripts for visual review:

```sh
CPH_UX_CAPTURE=/tmp/cph-cli-transcripts.json cargo test --locked -p cph-ng-judge --test cli_integration responsive_layouts -- --nocapture
```

The capture contains real PTY output, including IDs and timings from that test run. Full quality checks are listed in [quality.md](quality.md).

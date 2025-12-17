# Copilot Session Notes

_Last updated: 2025-12-17_

## What we already did
- Introduced DI scaffolding with `tsyringe` tokens/container; kept legacy behavior intact.
- Implemented `RunSingleTc` use case via ports/adapters (compiler, runner, problem repo). Added guard for missing `activePath`.
- Added adapters: `CompilerAdapter`, `RunnerAdapter`, `ProblemRepository` with `save`; aligned ports `ICompiler`, `IRunner`, `IProblemRepository` to current domain types.
- Pruned container registrations to the minimal set used by `RunSingleTc` (compiler/runner/problemRepository) and removed unused imports.
- Fixed telemetry adapter to use shared `telemetry` singleton and normalized event props; corrected settings adapter dynamic access; removed duplicate definitions in `ISettingsProvider` and `IProblemRepository`.
- Adjusted companion submitter language ID handling to satisfy narrow unions.
- Fixed import for `WebviewEventBusAdapter` to use `sidebarProvider` from `utils/global` (resolving webpack error).
- Formatting/lint/package previously passing; latest `pnpm exec tsc --noEmit` passes after fixes.

## Current state
- TypeScript typecheck (`pnpm exec tsc --noEmit`) is clean.
- DI container is minimal for current use case; other adapters/files remain for future work but not registered.
- No known lint/build issues; `pnpm run package` last reported success.

## Pending / future ideas
- If expanding DI further, reintroduce necessary ports/adapters thoughtfully; keep ports aligned with domain types (avoid duplicate DTO interfaces).
- Consider adding `pnpm exec tsc --noEmit` to CI/check scripts alongside lint.
- When pruning more, re-check container/tokens vs. actual use to avoid dead registrations.

## Quick pointers
- Key files: `src/composition/container.ts`, `src/composition/tokens.ts`, `src/application/usecases/RunSingleTc.ts`, adapters under `src/infrastructure/*`, ports under `src/application/ports/`.
- Telemetry singleton lives in `utils/global.ts`; adapter uses it.
- Settings adapter simply delegates to static `helpers/settings.ts` with safe lookup.

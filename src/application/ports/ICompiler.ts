import type { CompileData } from '@/core/compiler';
import type { Problem } from '@/types';
import type { KnownResult } from '@/utils/result';

export type CompileSuccess = { ok: true; data: CompileData };
export type CompileKnownFailure = {
  ok: false;
  known: KnownResult<CompileData>;
};
export type CompileException = { ok: false; error: Error };
export type CompileOutcome =
  | CompileSuccess
  | CompileKnownFailure
  | CompileException;

export interface ICompiler {
  compile(
    problem: Problem,
    compileFlag: boolean | null,
    ac: AbortController,
  ): Promise<CompileOutcome>;
}

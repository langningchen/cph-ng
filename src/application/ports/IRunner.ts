import type { CompileData } from '@/core/compiler';
import type { Lang } from '@/core/langs/lang';
import type { Problem, TcWithResult } from '@/types';
import type { KnownResult } from '@/utils/result';

export type RunSuccess = { ok: true };
export type RunKnownFailure = { ok: false; known: KnownResult<unknown> };
export type RunException = { ok: false; error: Error };
export type RunOutcome = RunSuccess | RunKnownFailure | RunException;

export interface IRunner {
  run(
    problem: Problem,
    tc: TcWithResult,
    lang: Lang,
    ac: AbortController,
    compileData: CompileData,
  ): Promise<RunOutcome>;
}

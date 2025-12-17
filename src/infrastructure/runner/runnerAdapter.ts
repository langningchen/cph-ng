import type { IRunner, RunOutcome } from '@/application/ports/IRunner';
import type { CompileData } from '@/core/compiler';
import type { Lang } from '@/core/langs/lang';
import { Runner } from '@/core/runner/runner';
import type { Problem, TcWithResult } from '@/types';

export class RunnerAdapter implements IRunner {
  async run(
    problem: Problem,
    tc: TcWithResult,
    lang: Lang,
    ac: AbortController,
    compileData: CompileData,
  ): Promise<RunOutcome> {
    try {
      await Runner.run(problem, tc, lang, ac, compileData);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}

export default RunnerAdapter;

import { inject, injectable } from 'tsyringe';
import type { IJudgeObserver } from '@/application/ports/problems/IJudgeObserver';
import type { IJudgeService, JudgeContext } from '@/application/ports/problems/IJudgeService';
import type { ILanguageStrategy } from '@/application/ports/problems/ILanguageStrategy';
import type { ISolutionRunner } from '@/application/ports/problems/runner/ISolutionRunner';
import { TOKENS } from '@/composition/tokens';
import { ResultEvaluator } from '@/infrastructure/problems/resultEvaluator';
import { TcVerdicts } from '@/types';

@injectable()
export class TraditionalJudgeService implements IJudgeService {
  constructor(
    @inject(TOKENS.SolutionRunner) private readonly runner: ISolutionRunner,
    @inject(ResultEvaluator) private readonly evaluator: ResultEvaluator,
    @inject(TOKENS.LanguageRegistry) private readonly lang: ILanguageStrategy,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    ac: AbortController,
  ): Promise<void> {
    try {
      const runCmd = await this.lang.getRunCommand(
        ctx.artifacts.solution.path,
        ctx.problem.overwrites,
      );

      observer.onStatusChange(TcVerdicts.JG);
      const executionResult = await this.runner.run(
        {
          cmd: runCmd,
          stdinPath: ctx.stdinPath,
          timeLimitMs: ctx.problem.timeLimit,
          memoryLimitMb: ctx.problem.memoryLimit,
        },
        ac,
      );
      if (executionResult instanceof Error) throw executionResult;
      observer.onStatusChange(TcVerdicts.JGD);

      observer.onStatusChange(TcVerdicts.CMP);
      const finalResult = await this.evaluator.judge(
        {
          executionResult,
          inputPath: ctx.stdinPath,
          answerPath: ctx.answerPath,
          checkerPath: ctx.artifacts.checker?.path,
          timeLimitMs: ctx.problem.timeLimit,
          memoryLimitMb: ctx.problem.memoryLimit,
        },
        ac,
      );
      observer.onResult(finalResult);
    } catch (e) {
      observer.onError(e as Error);
    }
  }
}

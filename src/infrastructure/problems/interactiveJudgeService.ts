import { inject, injectable } from 'tsyringe';
import type { IJudgeObserver } from '@/application/ports/problems/IJudgeObserver';
import type {
  IJudgeService,
  JudgeContext,
} from '@/application/ports/problems/IJudgeService';
import type { ILanguageStrategy } from '@/application/ports/problems/ILanguageStrategy';
import type { ISolutionRunner } from '@/application/ports/problems/runner/ISolutionRunner';
import { TOKENS } from '@/composition/tokens';
import { ResultEvaluator } from '@/infrastructure/problems/resultEvaluator';
import { TcVerdicts } from '@/types';

@injectable()
export class InteractiveJudgeService implements IJudgeService {
  constructor(
    @inject(TOKENS.SolutionRunner) private readonly runner: ISolutionRunner,
    @inject(TOKENS.LanguageRegistry) private readonly lang: ILanguageStrategy,
    @inject(ResultEvaluator) private readonly evaluator: ResultEvaluator,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    ac: AbortController,
  ): Promise<void> {
    try {
      if (!ctx.artifacts.interactor) {
        throw new Error('Interactor is missing for interactive problem');
      }
      const runCmd = await this.lang.getRunCommand(
        ctx.artifacts.solution.path,
        ctx.problem.overwrites,
      );

      observer.onStatusChange(TcVerdicts.JG);
      const executionResult = await this.runner.runInteractive(
        {
          cmd: runCmd,
          stdinPath: ctx.stdinPath,
          timeLimitMs: ctx.problem.timeLimit,
          memoryLimitMb: ctx.problem.memoryLimit,
        },
        ac,
        ctx.artifacts.interactor.path,
      );
      if (executionResult instanceof Error) throw executionResult;
      observer.onStatusChange(TcVerdicts.JGD);

      observer.onStatusChange(TcVerdicts.CMP);
      const finalResult = await this.evaluator.judge(
        {
          executionResult: executionResult.sol,
          inputPath: ctx.stdinPath,
          answerPath: ctx.answerPath,
          interactorResult: {
            execution: executionResult.int,
            feedback: executionResult.feedbackPath,
          },
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

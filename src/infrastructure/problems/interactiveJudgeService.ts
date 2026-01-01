import { inject, injectable } from 'tsyringe';
import type { IJudgeObserver } from '@/application/ports/problems/IJudgeObserver';
import type { IJudgeService, JudgeContext } from '@/application/ports/problems/IJudgeService';
import type { ISolutionRunner } from '@/application/ports/problems/runner/ISolutionRunner';
import type { ILanguageRegistry } from '@/application/ports/services/ILanguageRegistry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import { ExecutionRejected } from '@/domain/execution';
import { VerdictName } from '@/domain/verdict';
import { ResultEvaluator } from '@/infrastructure/problems/resultEvaluator';
import { TcVerdicts } from '@/types';

@injectable()
export class InteractiveJudgeService implements IJudgeService {
  constructor(
    @inject(ResultEvaluator) private readonly evaluator: ResultEvaluator,
    @inject(TOKENS.LanguageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.SolutionRunner) private readonly runner: ISolutionRunner,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    ac: AbortController,
  ): Promise<void> {
    try {
      if (!ctx.artifacts.interactor)
        throw new Error('Interactor is missing for interactive problem');

      const srcPath = ctx.problem.src.path;
      const srcLang = this.lang.getLang(srcPath);
      if (!srcLang)
        throw new ExecutionRejected(
          this.translator.t(
            'Cannot determine the programming language of the source file: {file}.',
            { file: srcPath },
          ),
        );

      const runCmd = await srcLang.getRunCommand(
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
      if (e instanceof ExecutionRejected)
        observer.onResult({ verdict: VerdictName.RJ, messages: [e.message] });
      else observer.onError(e as Error);
    }
  }
}

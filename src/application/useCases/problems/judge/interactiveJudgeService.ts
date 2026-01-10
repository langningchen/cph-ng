import { inject, injectable } from 'tsyringe';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { IJudgeService, JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import { VerdictName } from '@/domain/entities/verdict';
import { ExecutionRejected } from '@/domain/execution';
import type { ResultEvaluatorAdaptor } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';

@injectable()
export class InteractiveJudgeService implements IJudgeService {
  constructor(
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.resultEvaluator) private readonly evaluator: ResultEvaluatorAdaptor,
    @inject(TOKENS.solutionRunner) private readonly runner: ISolutionRunner,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    signal: AbortSignal,
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
        ctx.problem.overrides,
      );
      const limits = this.problemService.getLimits(ctx.problem);

      observer.onStatusChange(VerdictName.judging);
      const executionResult = await this.runner.runInteractive(
        { cmd: runCmd, stdinPath: ctx.stdinPath, ...limits },
        signal,
        ctx.artifacts.interactor.path,
      );
      if (executionResult instanceof Error) throw executionResult;
      observer.onStatusChange(VerdictName.judged);

      observer.onStatusChange(VerdictName.comparing);
      const finalResult = await this.evaluator.judge(
        {
          executionResult: executionResult.sol,
          inputPath: ctx.stdinPath,
          answerPath: ctx.answerPath,
          interactorResult: {
            execution: executionResult.int,
            feedback: executionResult.feedbackPath,
          },
          ...limits,
        },
        signal,
      );
      observer.onResult(finalResult);
    } catch (e) {
      if (e instanceof ExecutionRejected)
        observer.onResult({ verdict: VerdictName.rejected, msg: e.message });
      else observer.onError(e as Error);
    }
  }
}

import { inject, injectable } from 'tsyringe';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { IJudgeService, JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import { ExecutionRejected } from '@/domain/execution';
import { VerdictName } from '@/domain/verdict';
import type { ResultEvaluatorAdaptor } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import { TcVerdicts } from '@/types';

@injectable()
export class TraditionalJudgeService implements IJudgeService {
  constructor(
    @inject(TOKENS.ResultEvaluator) private readonly evaluator: ResultEvaluatorAdaptor,
    @inject(TOKENS.LanguageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.SolutionRunner) private readonly runner: ISolutionRunner,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    signal: AbortSignal,
  ): Promise<void> {
    try {
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

      observer.onStatusChange(TcVerdicts.JG);
      const executionResult = await this.runner.run(
        {
          cmd: runCmd,
          stdinPath: ctx.stdinPath,
          timeLimitMs: ctx.problem.timeLimit,
          memoryLimitMb: ctx.problem.memoryLimit,
        },
        signal,
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
        signal,
      );
      observer.onResult(finalResult);
    } catch (e) {
      if (e instanceof ExecutionRejected)
        observer.onResult({ verdict: VerdictName.RJ, messages: [e.message] });
      else observer.onError(e as Error);
    }
  }
}

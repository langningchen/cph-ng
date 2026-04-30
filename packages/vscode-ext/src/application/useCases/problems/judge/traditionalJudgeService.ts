// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { VerdictName } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { IJudgeService, JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IResultEvaluator } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { ExecutionRejected } from '@/domain/execution';

@injectable()
export class TraditionalJudgeService implements IJudgeService {
  public constructor(
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.resultEvaluator) private readonly evaluator: IResultEvaluator,
    @inject(TOKENS.solutionRunner) private readonly runner: ISolutionRunner,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {}

  public async judge(
    ctx: JudgeContext,
    observer: IJudgeObserver,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const srcPath = ctx.problem.src.path;
      const srcLang = this.lang.getLangByFile(srcPath);
      if (!srcLang)
        throw new ExecutionRejected(
          this.translator.t(
            'Cannot determine the programming language of the source file: {file}.',
            { file: srcPath },
          ),
        );

      const runCmd = await srcLang.getInterpretCommand(
        ctx.artifacts.solution.path,
        ctx.problem.overrides,
      );
      const limits = this.problemService.getLimits(ctx.problem);
      const cwd = this.path.dirname(srcPath);

      observer.onStatusChange(VerdictName.judging);
      const executionResult = await this.runner.run(
        { cmd: runCmd, stdinPath: ctx.stdinPath, cwd, ...limits },
        signal,
      );
      if (executionResult instanceof Error) throw executionResult;
      observer.onStatusChange(VerdictName.judged);
      observer.onStatusChange(VerdictName.comparing);
      const finalResult = await this.evaluator.judge(
        {
          executionResult,
          inputPath: ctx.stdinPath,
          answerPath: ctx.answerPath,
          checkerPath: ctx.artifacts.checker?.path,
          ...limits,
        },
        signal,
      );
      const stdout = new TestcaseIo({ path: executionResult.stdoutPath });
      const stderr = new TestcaseIo({ path: executionResult.stderrPath });
      await observer.onResult({
        verdict: finalResult.verdict,
        timeMs: finalResult.timeMs,
        memoryMb: finalResult.memoryMb,
        stdout: await this.testcaseIoService.tryInlining(stdout),
        stderr: await this.testcaseIoService.tryInlining(stderr),
        msg: finalResult.msg,
      });
    } catch (e) {
      if (e instanceof ExecutionRejected)
        await observer.onResult({ verdict: VerdictName.rejected, msg: e.message });
      else await observer.onError(e as Error);
    }
  }
}

// Copyright (C) 2025 Langning Chen
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

import { container } from 'tsyringe';
import { l10n } from 'vscode';
import { ISolutionRunner } from '@/application/ports/problems/ISolutionRunner';
import { TOKENS } from '@/composition/tokens';
import { JudgeCoordinator } from '@/infrastructure/problems/judgeCoordinator';
import type { CompileData } from '@/core/compiler';
import type { Lang } from '@/core/langs/lang';
import ProblemsManager from '@/modules/problems/manager';
import { type Problem, TcIo, TcVerdicts, type TcWithResult } from '@/types';
import { telemetry } from '@/utils/global';

/**
 * @deprecated Use RunSingleTc or RunAllTestCases use cases instead.
 */
export class Runner {
  public static async run(
    problem: Problem,
    tc: TcWithResult,
    lang: Lang,
    ac: AbortController,
    compileData: CompileData,
  ) {
    const solutionRunner = container.resolve<ISolutionRunner>(
      TOKENS.SolutionRunner,
    );
    const judgeCoordinator = container.resolve(JudgeCoordinator);

    const runTimerEnd = telemetry.start('run', {
      lang: lang.name,
      timeLimit: problem.timeLimit.toString(),
      memoryLimit: problem.memoryLimit.toString(),
      checker: String(!!problem.checker),
      interactor: String(!!problem.interactor),
    });

    try {
      tc.result.verdict = TcVerdicts.JG;
      await ProblemsManager.dataRefresh();

      const cmd = await lang.getRunCommand(
        compileData.src.outputPath,
        problem.compilationSettings,
      );

      const executionResult = await solutionRunner.run(
        {
          cmd,
          stdin: tc.stdin,
          timeLimitMs: problem.timeLimit,
          memoryLimitMb: problem.memoryLimit,
        },
        ac,
      );

      if (!(executionResult instanceof Error)) {
        tc.result.time = executionResult.timeMs;
        tc.result.memory = executionResult.memoryMb;
        tc.result.stdout = new TcIo(true, executionResult.stdoutPath);
        tc.result.stderr = new TcIo(true, executionResult.stderrPath);
        await ProblemsManager.dataRefresh();
      }

      if (executionResult instanceof Error) {
        tc.result.verdict = TcVerdicts.SE;
        tc.result.msg.push(executionResult.message);
        return;
      }

      tc.result.verdict = TcVerdicts.JGD;
      await ProblemsManager.dataRefresh();

      const judgeResult = await judgeCoordinator.judge(
        {
          executionResult,
          inputPath: tc.stdin.toPath(),
          answerPath: tc.answer.toPath(),
          checkerPath: compileData.checker?.outputPath,
          timeLimitMs: problem.timeLimit,
          memoryLimitMb: problem.memoryLimit,
        },
        ac,
      );

      // Map VerdictName to TcVerdict
      // Note: VERDICTS from domain/verdict.ts has the same keys as TcVerdicts
      // but TcVerdicts values are TcVerdict instances, while VERDICTS values are Verdict objects.
      // We need to map back to TcVerdicts which are used in the legacy code.
      // Fortunately, the keys are the same.
      const verdictName = judgeResult.verdict;
      // @ts-ignore - TcVerdicts keys match VerdictName
      tc.result.verdict = TcVerdicts[verdictName];
      tc.result.msg = judgeResult.messages;

      runTimerEnd({ verdict: tc.result.verdict.name });
    } catch (e) {
      tc.result.verdict = TcVerdicts.SE;
      tc.result.msg.push(
        l10n.t('Runtime error occurred: {error}', {
          error: (e as Error).message,
        }),
      );
      telemetry.error('runError', e);
    } finally {
      await tc.result.stdout.inlineSmall();
      await tc.result.stderr.inlineSmall();
      await ProblemsManager.dataRefresh();
    }
  }
}

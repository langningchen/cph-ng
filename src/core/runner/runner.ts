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

import { Checker } from '@/core/checker';
import { CompileData } from '@/core/compiler';
import { Lang } from '@/core/langs/lang';
import { ProcessResultHandler } from '@/helpers/processResultHandler';
import Settings from '@/helpers/settings';
import ProblemsManager from '@/modules/problems/manager';
import { Problem, TcIo, TcVerdicts, TcWithResult } from '@/types';
import { telemetry } from '@/utils/global';
import { KnownResult } from '@/utils/result';
import { readFile } from 'fs/promises';
import { l10n } from 'vscode';
import { Executor } from './executor';

export class Runner {
  public static async run(
    problem: Problem,
    tc: TcWithResult,
    lang: Lang,
    ac: AbortController,
    compileData: CompileData,
  ) {
    const runTimerEnd = telemetry.start('run', {
      lang: lang.name,
      timeLimit: problem.timeLimit.toString(),
      memoryLimit: problem.memoryLimit.toString(),
      checker: String(!!problem.checker),
      interactor: String(!!problem.interactor),
      useRunner: String(Settings.runner.useRunner),
      unlimitedStack: String(Settings.runner.unlimitedStack),
    });
    try {
      tc.result.verdict = TcVerdicts.JG;
      await ProblemsManager.dataRefresh();

      const runResult = await Executor.doRun(
        {
          cmd: await lang.getRunCommand(
            compileData.src.outputPath,
            problem.compilationSettings,
          ),
          timeLimit: problem.timeLimit,
          stdin: tc.stdin,
          ac,
          enableRunner: lang.enableRunner,
        },
        compileData.interactor?.outputPath,
      );
      if (runResult.data) {
        const { time, memory, stdoutPath, stderrPath } = runResult.data;

        // Update time and memory
        tc.result.time = time;
        tc.result.memory = memory;

        // Handle stdout and stderr
        tc.result.stdout = new TcIo(true, stdoutPath);
        tc.result.stderr = new TcIo(true, stderrPath);
        await ProblemsManager.dataRefresh();
      }
      if (runResult instanceof KnownResult) {
        tc.result.fromResult(runResult);
        return;
      }
      tc.result.verdict = TcVerdicts.JGD;

      // Determine verdict
      if (tc.result.time && tc.result.time > problem.timeLimit) {
        tc.result.verdict = TcVerdicts.TLE;
      } else if (tc.result.memory && tc.result.memory > problem.memoryLimit) {
        tc.result.verdict = TcVerdicts.MLE;
      } else {
        tc.result.verdict = TcVerdicts.CMP;
        await ProblemsManager.dataRefresh();
        if (compileData.checker) {
          const checkerResult = await Checker.runChecker(
            compileData.checker.outputPath,
            tc,
            ac,
          );
          tc.result.fromResult(checkerResult);
          const stderrPath = checkerResult.data?.stderrPath;
          if (stderrPath) {
            tc.result.msg.push(await readFile(stderrPath, 'utf-8'));
          }
        } else {
          tc.result.fromResult(
            ProcessResultHandler.compareOutputs(
              tc.result.stdout.toString(),
              tc.answer.toString(),
              tc.result.stderr.toString(),
            ),
          );
        }
      }
      runTimerEnd({ verdict: tc.result.verdict.name });
    } catch (e) {
      tc.result.verdict = TcVerdicts.SE;
      tc.result.msg.push(
        l10n.t('Runtime error occurred: {error}', {
          error: (e as Error).message,
        }),
      );
      telemetry.error('runError', {
        error: (e as Error).message,
      });
    } finally {
      await tc.result.stdout.inlineSmall();
      await tc.result.stderr.inlineSmall();
      await ProblemsManager.dataRefresh();
    }
  }
}

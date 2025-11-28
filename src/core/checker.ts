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

import Cache from '@/helpers/cache';
import Logger from '@/helpers/logger';
import ProcessExecutor from '@/helpers/processExecutor';
import {
  ProcessData,
  ProcessResultHandler,
} from '@/helpers/processResultHandler';
import { TcWithResult } from '@/types';
import { KnownResult } from '@/utils/result';
import assert from 'assert';

export class Checker {
  private static logger: Logger = new Logger('checker');

  public static async runChecker(
    checkerPath: string,
    tc: TcWithResult,
    ac: AbortController,
  ): Promise<KnownResult<ProcessData>> {
    this.logger.debug('Running checker', checkerPath, 'on tc', tc);

    // The tc should have stdout and stderr stored in files
    // Because we directly pass the file paths in the runner.ts
    assert(tc.result.stdout.useFile && tc.result.stderr.useFile);

    const stdinPath = tc.stdin.toPath();
    const answerPath = tc.answer.toPath();
    // checker <InputFile> <OutputFile> <AnswerFile>
    // https://github.com/MikeMirzayanov/testlib?tab=readme-ov-file#checker
    const result = await ProcessExecutor.execute({
      cmd: [checkerPath, stdinPath, tc.result.stdout.data, answerPath],
      ac,
    });
    this.logger.debug('Checker completed', result);

    // Dispose the temp files created for tc
    tc.stdin.useFile || Cache.dispose(stdinPath);
    tc.answer.useFile || Cache.dispose(answerPath);

    const checkerResult = await ProcessResultHandler.parseChecker(result);
    this.logger.debug('Parsed checker result', checkerResult);
    return checkerResult;
  }
}

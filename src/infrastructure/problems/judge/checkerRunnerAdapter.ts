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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  CheckerOptions,
  CheckerResult,
  ICheckerRunner,
} from '@/application/ports/problems/judge/ICheckerRunner';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class CheckerRunnerAdapter implements ICheckerRunner {
  constructor(
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
  ) {
    this.logger = this.logger.withScope('CheckerRunner');
  }

  public async run(options: CheckerOptions, signal: AbortSignal): Promise<CheckerResult> {
    this.logger.trace('Running checker', options);

    // checker <InputFile> <OutputFile> <AnswerFile>
    // https://github.com/MikeMirzayanov/testlib?tab=readme-ov-file#checker
    const result = await this.executor.execute({
      cmd: [options.checkerPath, options.inputPath, options.outputPath, options.answerPath],
      signal,
    });
    this.logger.debug('Checker completed', result);
    if (result instanceof Error) return result;

    const message = await this.fs.readFile(result.stderrPath);
    this.tmp.dispose([result.stdoutPath, result.stderrPath]);
    if (typeof result.codeOrSignal === 'string') {
      return new Error('Checker run failed');
    }
    return {
      exitCode: result.codeOrSignal,
      msg: message.trim(),
    };
  }
}

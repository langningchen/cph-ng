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

import { LangCpp } from '@/core/langs/cpp';
import Cache from '@/helpers/cache';
import Logger from '@/helpers/logger';
import ProcessExecutor from '@/helpers/processExecutor';
import {
  ProcessData,
  ProcessResultHandler,
} from '@/helpers/processResultHandler';
import Settings from '@/helpers/settings';
import { TcIo, TcVerdicts } from '@/types';
import { extensionPath } from '@/utils/global';
import { exists } from '@/utils/process';
import { KnownResult, Result } from '@/utils/result';
import { readFile, writeFile } from 'fs/promises';
import { type } from 'os';
import { join } from 'path';
import { l10n } from 'vscode';

export interface RunOptions {
  cmd: string[];
  timeLimit: number;
  stdin: TcIo;
  ac: AbortController;
  enableRunner: boolean;
}

export class Executor {
  private static logger: Logger = new Logger('executor');

  // The KnownResult<ProcessData>.data must be not-null when verdict is UKE
  public static async doRun(
    options: RunOptions,
    interactor?: string,
  ): Promise<Result<ProcessData>> {
    this.logger.trace('runExecutable', { options, interactor });
    return interactor
      ? this.runWithInteractor(interactor, options)
      : this.runWithoutInteractor(options);
  }

  private static async getRunnerPath(): Promise<string | null> {
    const srcPath =
      type() === 'Windows_NT'
        ? join(extensionPath, 'res', 'runner-windows.cpp')
        : join(extensionPath, 'res', 'runner-linux.cpp');
    const outputPath = join(
      Settings.cache.directory,
      type() === 'Windows_NT' ? 'runner-windows.exe' : 'runner-linux',
    );
    if (await exists(outputPath)) {
      this.logger.debug('Using cached runner program', { outputPath });
      return outputPath;
    }
    const runnerLang = new LangCpp();
    const langCompileResult = await runnerLang.compile(
      { path: srcPath },
      new AbortController(),
      null,
      {
        canUseWrapper: false,
        compilationSettings: {
          compiler: Settings.compilation.cppCompiler,
          compilerArgs:
            type() === 'Windows_NT' ? '-lpsapi -ladvapi32 -static' : '-pthread',
        },
      },
    );
    if (langCompileResult instanceof KnownResult) {
      this.logger.error('Failed to compile runner program', langCompileResult);
      return null;
    }
    if (langCompileResult.data.outputPath !== outputPath) {
      this.logger.error('Runner program output path mismatch');
      return null;
    }
    return outputPath;
  }

  private static async runWithoutInteractor(
    options: RunOptions,
  ): Promise<Result<ProcessData>> {
    if (Settings.runner.useRunner && Settings.compilation.useWrapper) {
      return new KnownResult(
        TcVerdicts.RJ,
        l10n.t('Cannot use both runner and wrapper at the same time'),
      );
    }

    let runnerPath: string | null = null;
    if (Settings.runner.useRunner && options.enableRunner) {
      runnerPath = await this.getRunnerPath();
      if (!runnerPath) {
        return new KnownResult(
          TcVerdicts.SE,
          l10n.t('Failed to compile runner program'),
        );
      }
    }

    // Adjust time limit for runner overhead
    return await ProcessResultHandler.parse(
      await (runnerPath
        ? ProcessExecutor.executeWithRunner(
            {
              ...options,
              timeout: options.timeLimit + Settings.runner.timeAddition,
            },
            runnerPath,
          )
        : ProcessExecutor.execute({
            ...options,
            cmd: Settings.runner.unlimitedStack
              ? [...options.cmd, '--unlimited-stack']
              : options.cmd,
            timeout: options.timeLimit + Settings.runner.timeAddition,
          })),
    );
  }

  private static async runWithInteractor(
    interactor: string,
    options: RunOptions,
  ): Promise<KnownResult<ProcessData>> {
    // Prepare input and output files
    const inputPath = options.stdin.useFile
      ? options.stdin.data
      : Cache.createIo();
    const stdoutPath = Cache.createIo();
    options.stdin.useFile || (await writeFile(inputPath, options.stdin.data));

    // Launch both processes with pipe
    const { process1: solResult, process2: intResult } =
      await ProcessExecutor.launchWithPipe(
        {
          cmd: options.cmd,
          timeout: options.timeLimit + Settings.runner.timeAddition,
          ac: options.ac,
        },
        {
          cmd: [interactor, inputPath, stdoutPath],
          timeout: options.timeLimit + Settings.runner.timeAddition,
          ac: options.ac,
        },
      );
    this.logger.debug('Interactor execution completed', {
      solResult,
      intResult,
    });

    // Dispose of input file if it was created by Cache
    options.stdin.useFile || Cache.dispose(inputPath);

    // Process results
    const solProcessResult = await ProcessResultHandler.parse(solResult);
    const intProcessResult = await ProcessResultHandler.parseChecker(intResult);
    if (solProcessResult instanceof KnownResult) {
      intProcessResult.data &&
        Cache.dispose([
          intProcessResult.data.stdoutPath,
          intProcessResult.data.stderrPath,
        ]);
      return solProcessResult;
    }
    if (intProcessResult.data) {
      const msg = [
        intProcessResult.msg,
        await readFile(intProcessResult.data.stdoutPath, 'utf-8'),
        await readFile(intProcessResult.data.stderrPath, 'utf-8'),
      ]
        .filter((m) => !!m)
        .join('\n\n');
      Cache.dispose([
        intProcessResult.data.stdoutPath,
        intProcessResult.data.stderrPath,
      ]);
      return new KnownResult(
        intProcessResult.verdict,
        msg,
        solProcessResult.data,
      );
    }
    return new KnownResult(
      intProcessResult.verdict,
      intProcessResult.msg,
      solProcessResult.data,
    );
  }
}

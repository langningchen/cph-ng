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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessHandle,
} from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IExecutionStrategy } from '@/application/ports/problems/runner/execution/strategies/IExecutionStrategy';
import type { IRunnerProvider } from '@/application/ports/problems/runner/execution/strategies/IRunnerProvider';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionData, ExecutionResult } from '@/domain/execution';

type RunnerOutput =
  | {
      error: false;
      killed: boolean;
      time: number;
      memory: number;
      exitCode: number;
      signal: number;
    }
  | {
      error: true;
      error_type: number;
      error_code: number;
    };

@injectable()
export class ExternalRunnerStrategy implements IExecutionStrategy {
  constructor(
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
    @inject(TOKENS.RunnerProvider)
    private readonly runner: IRunnerProvider,
  ) {
    this.logger = this.logger.withScope('ExternalRunnerStrategy');
  }

  async execute(ctx: ExecutionContext, ac: AbortController): Promise<ExecutionResult> {
    this.logger.trace('execute', ctx);

    const userStdinPath = ctx.stdinPath;
    const userStdoutPath = this.tmp.create();
    const userStderrPath = this.tmp.create();

    let runnerPath: string;
    try {
      runnerPath = await this.runner.getRunnerPath(ac);
    } catch (e) {
      return new Error(
        this.translator.t('Failed to prepare runner utility: {codeOrSignal}', {
          codeOrSignal: (e as Error).message,
        }),
      );
    }

    if (ctx.cmd.length !== 1) {
      return new Error(
        this.translator.t('External runner only supports single program without arguments'),
      );
    }

    const runnerCmd = [runnerPath, ctx.cmd[0], userStdinPath, userStdoutPath, userStderrPath];
    if (this.settings.runner.unlimitedStack) {
      runnerCmd.push('--unlimited-stack');
    }

    // We use our own timeout handling to allow graceful exit
    const handle = await this.executor.spawn({
      cmd: runnerCmd,
    });

    const unifiedAc = new AbortController();
    const onUserAbort = () => {
      this.logger.warn(`Soft killing runner ${handle.pid} due to user abort`);
      unifiedAc.abort(AbortReason.UserAbort);
    };
    const onUnifiedAbort = () => {
      this.performSoftKill(handle);
    };
    ac.signal.addEventListener('abort', onUserAbort);
    unifiedAc.signal.addEventListener('abort', onUnifiedAbort);

    const timeoutVal = ctx.timeLimitMs + this.settings.runner.timeAddition;
    const timeoutId = setTimeout(() => {
      this.logger.warn(`Soft killing runner ${handle.pid} due to timeout`);
      unifiedAc.abort(AbortReason.Timeout);
    }, timeoutVal);

    const runnerResult = await handle.wait();
    clearTimeout(timeoutId);
    if (runnerResult instanceof Error) {
      this.tmp.dispose([handle.stdoutPath, handle.stderrPath, userStdoutPath, userStderrPath]);
      return runnerResult;
    }

    const runnerOutputRaw = await this.fs.readFile(runnerResult.stdoutPath);
    this.tmp.dispose([runnerResult.stdoutPath, runnerResult.stderrPath]);

    if (runnerResult.codeOrSignal) {
      this.tmp.dispose([userStdoutPath, userStderrPath]);
      return new Error(
        this.translator.t('Runner exited with code {codeOrSignal}', {
          codeOrSignal: runnerResult.codeOrSignal,
        }),
      );
    }

    let runInfo: RunnerOutput;
    try {
      runInfo = JSON.parse(runnerOutputRaw);
    } catch (e) {
      this.logger.error('Failed to parse runner output', e, {
        output: runnerOutputRaw,
      });
      this.telemetry.error('parseRunnerError', e as Error, {
        output: runnerOutputRaw,
      });
      this.tmp.dispose([userStdoutPath, userStderrPath]);
      throw new Error(this.translator.t('Runner output is invalid JSON'));
    }
    this.logger.debug('Runner info', runInfo);
    if (runInfo.error) {
      this.tmp.dispose([userStdoutPath, userStderrPath]);
      throw new Error(
        this.translator.t('Runner reported error: {type} (Code: {code})', {
          type: runInfo.error_type,
          code: runInfo.error_code,
        }),
      );
    }

    return {
      codeOrSignal: runInfo.signal !== 0 ? runInfo.signal : runInfo.exitCode,
      stdoutPath: userStdoutPath,
      stderrPath: userStderrPath,
      timeMs: runInfo.time,
      memoryMb: runInfo.memory,
      isUserAborted: unifiedAc.signal.reason === AbortReason.UserAbort,
    } satisfies ExecutionData;
  }

  private performSoftKill(handle: ProcessHandle) {
    try {
      handle.writeStdin('k');
      handle.closeStdin();
    } catch (e) {
      this.logger.warn('Failed to perform soft kill', e);
    }
  }
}

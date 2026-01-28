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

import { constants } from 'node:os';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessHandle,
} from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IExecutionStrategy } from '@/application/ports/problems/judge/runner/execution/strategies/IExecutionStrategy';
import type { IRunnerProvider } from '@/application/ports/problems/judge/runner/execution/strategies/IRunnerProvider';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionData, ExecutionResult } from '@/domain/execution';

export type RunnerOutput =
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
      errorType: number;
      errorCode: number;
    };

@injectable()
export class ExternalRunnerStrategy implements IExecutionStrategy {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.runnerProvider) private readonly runner: IRunnerProvider,
  ) {
    this.logger = this.logger.withScope('externalRunnerStrategy');
  }

  public async execute(ctx: ExecutionContext, signal: AbortSignal): Promise<ExecutionResult> {
    this.logger.trace('execute', ctx);

    let runnerPath: string;
    try {
      runnerPath = await this.runner.getRunnerPath(signal);
      console.log(runnerPath);
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

    const userStdinPath = ctx.stdinPath;
    const userStdoutPath = this.tmp.create(`externalRunner.userStdoutPath`);
    const userStderrPath = this.tmp.create(`externalRunner.userStderrPath`);

    const runnerCmd = [runnerPath, ctx.cmd[0], userStdinPath, userStdoutPath, userStderrPath];
    if (this.settings.runner.unlimitedStack) runnerCmd.push('--unlimited-stack');

    // We use our own timeout handling to allow graceful exit
    const handle = this.executor.spawn({
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
    signal.addEventListener('abort', onUserAbort);
    unifiedAc.signal.addEventListener('abort', onUnifiedAbort);

    const timeoutVal = ctx.timeLimitMs + this.settings.runner.timeAddition;
    const timeoutId = setTimeout(() => {
      this.logger.warn(`Soft killing runner ${handle.pid} due to timeout`);
      unifiedAc.abort(AbortReason.Timeout);
    }, timeoutVal);

    const runnerResult = await handle.wait;
    clearTimeout(timeoutId);
    if (runnerResult instanceof Error) {
      this.tmp.dispose([handle.stdoutPath, handle.stderrPath, userStdoutPath, userStderrPath]);
      return runnerResult;
    }

    const runnerOutputRaw = await this.fs.readFile(runnerResult.stdoutPath);
    this.tmp.dispose([runnerResult.stdoutPath, runnerResult.stderrPath]);
    this.logger.trace('Runner output', runnerOutputRaw);

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
      return new Error(this.translator.t('Runner output is invalid JSON'));
    }
    this.logger.debug('Runner info', runInfo);
    if (runInfo.error) {
      this.tmp.dispose([userStdoutPath, userStderrPath]);
      return new Error(
        this.translator.t('Runner reported error: {type} (Code: {code})', {
          type: runInfo.errorType,
          code: runInfo.errorCode,
        }),
      );
    }

    return {
      codeOrSignal: runInfo.signal !== 0 ? this.getSignalName(runInfo.signal) : runInfo.exitCode,
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

  private getSignalName(signalNumber: number): NodeJS.Signals {
    const signals = constants.signals;
    const signal = Object.entries(signals).find(([_key, value]) => value === signalNumber);
    if (!signal) throw new Error('Unknown signal number');
    return signal[0] as NodeJS.Signals;
  }
}

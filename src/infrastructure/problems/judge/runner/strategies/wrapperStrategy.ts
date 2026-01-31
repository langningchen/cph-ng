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
import { AbortReason, type IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IExecutionStrategy } from '@/application/ports/problems/judge/runner/execution/strategies/IExecutionStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionResult } from '@/domain/execution';

export interface WrapperData {
  time: number; // microseconds
}

@injectable()
export class WrapperStrategy implements IExecutionStrategy {
  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    this.logger = this.logger.withScope('wrapperStrategy');
  }

  public async execute(ctx: ExecutionContext, signal: AbortSignal): Promise<ExecutionResult> {
    const reportPath = this.tmp.create('wrapperStrategy.reportPath');
    const res = await this.executor.execute({
      cmd: ctx.cmd,
      timeoutMs: ctx.timeLimitMs + this.settings.runner.timeAddition,
      stdinPath: ctx.stdinPath,
      signal,
      env: {
        CPH_NG_REPORT_PATH: reportPath,
        CPH_NG_UNLIMITED_STACK: this.settings.runner.unlimitedStack ? '1' : '0',
      },
    });
    if (res instanceof Error) return res;
    const data: ExecutionResult = {
      codeOrSignal: res.codeOrSignal,
      stdoutPath: res.stdoutPath,
      stderrPath: res.stderrPath,
      timeMs: res.timeMs,
      isUserAborted: res.abortReason === AbortReason.UserAbort,
    };
    const wrapperData = await this.readWrapperReport(reportPath);
    if (wrapperData) data.timeMs = wrapperData.time / 1000;
    this.tmp.dispose(reportPath);
    return data;
  }

  private async readWrapperReport(path: string): Promise<WrapperData | null> {
    const content = await this.fs.readFile(path);
    if (!content.trim()) {
      this.logger.warn('Wrapper report is empty');
      return null;
    }
    this.logger.trace('Wrapper report content', content);
    try {
      return JSON.parse(content) as WrapperData;
    } catch (e) {
      this.logger.error('Failed to parse wrapper report', e as Error);
      this.telemetry.error('wrapperError', e, { content });
      return null;
    }
  }
}

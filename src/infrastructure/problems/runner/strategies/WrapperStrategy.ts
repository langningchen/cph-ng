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
} from '@/application/ports/node/IProcessExecutor';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionResult } from '@/domain/execution';
import type { IRunStrategy } from '@/infrastructure/problems/runner/strategies/IRunStrategy';

export interface WrapperData {
  time: number; // microseconds
}

@injectable()
export class WrapperStrategy implements IRunStrategy {
  constructor(
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
  ) {
    this.logger = this.logger.withScope('WrapperStrategy');
  }

  async execute(
    ctx: ExecutionContext,
    ac: AbortController,
  ): Promise<ExecutionResult> {
    const res = await this.executor.execute({
      cmd: ctx.cmd,
      timeoutMs: ctx.timeLimitMs + this.settings.runner.timeAddition,
      stdin: ctx.stdin,
      ac,
    });
    if (res instanceof Error) return res;
    const wrapperData = await this.extractWrapperData(res.stderrPath);
    const data: ExecutionResult = {
      ...res,
      isAborted: res.abortReason === AbortReason.UserAbort,
    };
    if (wrapperData) data.timeMs = wrapperData.time / 1_000;
    return data;
  }

  private async extractWrapperData(
    stderrPath: string,
  ): Promise<WrapperData | null> {
    const content = await this.fs.readFile(stderrPath);
    const regex = /-----CPH DATA STARTS-----(\{.*?\})-----/s;
    const match = content.match(regex);
    if (!match) return null;
    try {
      await this.fs.safeWriteFile(
        stderrPath,
        content.replace(regex, '').trim(),
      );
      return JSON.parse(match[1]) as WrapperData;
    } catch (e) {
      this.logger.error('Failed to parse wrapper data JSON', e as Error);
      this.telemetry.error('wrapperError', e, {
        output: match[1],
      });
    }
    return null;
  }
}

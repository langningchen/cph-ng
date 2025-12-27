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
import {
  AbortReason,
  type IProcessExecutor,
} from '@/application/ports/node/IProcessExecutor';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionResult } from '@/domain/execution';
import type { IRunStrategy } from '@/infrastructure/problems/runner/strategies/IRunStrategy';

@injectable()
export class NormalStrategy implements IRunStrategy {
  constructor(
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
  ) {}

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
    const data: ExecutionResult = {
      ...res,
      isAborted: res.abortReason === AbortReason.UserAbort,
    };
    return data;
  }
}

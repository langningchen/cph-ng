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
import { AbortReason, type IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IExecutionStrategyFactory } from '@/application/ports/problems/runner/execution/IExecutionStrategyFactory';
import type { IExecutionStrategy } from '@/application/ports/problems/runner/execution/strategies/IExecutionStrategy';
import type { ISolutionRunner } from '@/application/ports/problems/runner/ISolutionRunner';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import {
  type ExecutionContext,
  ExecutionRejected,
  type ExecutionResult,
  type InteractiveExecutionResult,
} from '@/domain/execution';

@injectable()
export class SolutionRunnerAdapter implements ISolutionRunner {
  constructor(
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.ExecutionStrategyFactory)
    private readonly factory: IExecutionStrategyFactory,
  ) {
    this.logger = this.logger.withScope('RunnerAdapter');
  }

  async run(ctx: ExecutionContext, ac: AbortController): Promise<ExecutionResult> {
    const strategy = this.getStrategy();
    if (strategy instanceof Error) return strategy;
    return strategy.execute(ctx, ac);
  }

  private getStrategy(): IExecutionStrategy | Error {
    const useRunner = this.settings.runner.useRunner;
    const useWrapper = this.settings.compilation.useWrapper;
    if (useRunner && useWrapper)
      return new ExecutionRejected(
        this.translator.t('Cannot use both external runner and wrapper at the same time'),
      );
    if (useRunner) return this.factory.create('external');
    if (useWrapper) return this.factory.create('wrapper');
    return this.factory.create('normal');
  }

  // Interactive problem only supports the normal running strategy
  public async runInteractive(
    ctx: ExecutionContext,
    ac: AbortController,
    interactorPath: string,
  ): Promise<InteractiveExecutionResult> {
    const timeoutMs = ctx.timeLimitMs + this.settings.runner.timeAddition;

    // Prepare input and output files
    const intStdinPath = ctx.stdinPath;
    const intStdoutPath = this.tmp.create();

    // Launch both processes with pipe
    const { res1: solResult, res2: intResult } = await this.executor.executeWithPipe(
      { cmd: ctx.cmd, timeoutMs, ac },
      { cmd: [interactorPath, intStdinPath, intStdoutPath], timeoutMs, ac },
    );
    this.logger.debug('Interactor execution completed', {
      solResult,
      intResult,
    });

    if (solResult instanceof Error) return solResult;
    if (intResult instanceof Error) return intResult;
    return {
      sol: {
        ...solResult,
        isUserAborted: solResult.abortReason === AbortReason.UserAbort,
      },
      int: {
        ...intResult,
        isUserAborted: intResult.abortReason === AbortReason.UserAbort,
      },
      feedbackPath: intStdoutPath,
    };
  }
}

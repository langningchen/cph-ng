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

import { AbortReason, type IProcessExecutor } from '@v/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@v/application/ports/node/ITempStorage';
import type { IExecutionStrategyFactory } from '@v/application/ports/problems/judge/runner/execution/IExecutionStrategyFactory';
import type { IExecutionStrategy } from '@v/application/ports/problems/judge/runner/execution/strategies/IExecutionStrategy';
import type { ISolutionRunner } from '@v/application/ports/problems/judge/runner/ISolutionRunner';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ISettings } from '@v/application/ports/vscode/ISettings';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import { TOKENS } from '@v/composition/tokens';
import {
  type ExecutionContext,
  ExecutionRejected,
  type ExecutionResult,
  type InteractiveExecutionResult,
} from '@v/domain/execution';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SolutionRunnerAdapter implements ISolutionRunner {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.executionStrategyFactory)
    private readonly factory: IExecutionStrategyFactory,
  ) {
    this.logger = this.logger.withScope('solutionRunner');
  }

  public async run(ctx: ExecutionContext, signal: AbortSignal): Promise<ExecutionResult> {
    const strategy = this.getStrategy();
    if (strategy instanceof Error) return strategy;
    return strategy.execute(ctx, signal);
  }

  private getStrategy(): IExecutionStrategy | Error {
    const { useRunner, useWrapper } = this.settings.run;
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
    signal: AbortSignal,
    interactorPath: string,
  ): Promise<InteractiveExecutionResult> {
    const timeoutMs = ctx.timeLimitMs + this.settings.run.timeAddition;

    // Prepare input and output files
    const intStdinPath = ctx.stdinPath;
    const intStdoutPath = this.tmp.create(`solutionRunner.intStdoutPath`);

    // Launch both processes with pipe
    const { res1: solResult, res2: intResult } = await this.executor.executeWithPipe(
      { cmd: ctx.cmd, timeoutMs, signal },
      { cmd: [interactorPath, intStdinPath, intStdoutPath], timeoutMs, signal },
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

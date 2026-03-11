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

import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@v/application/ports/problems/IProblemService';
import type { IActivePathService } from '@v/application/ports/vscode/IActivePathService';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import { TOKENS } from '@v/composition/tokens';
import type { BackgroundProblem } from '@v/domain/entities/backgroundProblem';
import { inject, injectable } from 'tsyringe';
import type {
  CancellationToken,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  PreparedToolInvocation,
} from 'vscode';
import { BaseLlmTool, type BaseLlmToolParams } from './baseLlmTool';

@injectable()
export class LlmProblemContext extends BaseLlmTool<BaseLlmToolParams> {
  public constructor(
    @inject(TOKENS.problemRepository) repo: IProblemRepository,
    @inject(TOKENS.activePathService) activePathService: IActivePathService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
  ) {
    super(repo, activePathService);
  }

  public async prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<BaseLlmToolParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    return {
      invocationMessage: this.translator.t('Fetching CPH-NG problem context...'),
    };
  }

  public async run(
    _input: BaseLlmToolParams,
    bgProblem: BackgroundProblem,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const problem = bgProblem.problem;
    const limits = this.problemService.getLimits(problem);

    const context = {
      metadata: {
        name: problem.name,
        url: problem.url,
        timeLimitMs: limits.timeLimitMs,
        memoryLimitMb: limits.memoryLimitMb,
        srcPath: problem.src.path,
        checker: problem.checker?.path,
        interactor: problem.interactor?.path,
      },
      testcases: problem.testcaseOrder.map((testcaseId) => {
        const testcase = problem.getTestcase(testcaseId);
        return {
          testcaseId,
          verdict: testcase.result?.verdict ?? 'NOT_RUN',
          timeMs: testcase.result?.timeMs,
          memoryMb: testcase.result?.memoryMb,
          isDisabled: testcase.isDisabled,
        };
      }),
    };

    return this.createResult(JSON.stringify(context));
  }
}

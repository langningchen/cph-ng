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
import type {
  CancellationToken,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  PreparedToolInvocation,
} from 'vscode';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { RunAllTestcases } from '@/application/useCases/webview/RunAllTestcases';
import { RunSingleTestcase } from '@/application/useCases/webview/RunSingleTestcase';
import { StopTestcases } from '@/application/useCases/webview/StopTestcases';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Verdicts } from '@/domain/entities/verdict';
import type { TestcaseId } from '@/domain/types';
import { BaseLlmTool, type BaseLlmToolParams } from './baseLlmTool';

interface LlmTestcaseRunnerParams extends BaseLlmToolParams {
  testcaseId?: TestcaseId;
}

@injectable()
export class LlmTestcaseRunner extends BaseLlmTool<LlmTestcaseRunnerParams> {
  public constructor(
    @inject(TOKENS.problemRepository) repo: IProblemRepository,
    @inject(TOKENS.activePathService) activePathService: IActivePathService,
    @inject(RunAllTestcases) private readonly runAllTestcases: RunAllTestcases,
    @inject(RunSingleTestcase) private readonly runSingleTestcase: RunSingleTestcase,
    @inject(StopTestcases) private readonly stopTestcases: StopTestcases,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo, activePathService);
  }

  public async prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<LlmTestcaseRunnerParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    const { testcaseId } = options.input;
    const invocationMessage = testcaseId
      ? this.translator.t('Running test case {testcaseId}...', { testcaseId })
      : this.translator.t('Running all test cases...');
    const title = this.translator.t('Run Test Cases');
    const message = testcaseId
      ? this.translator.t('Do you want to run test case {testcaseId}?', { testcaseId })
      : this.translator.t('Do you want to run all test cases?');
    return { invocationMessage, confirmationMessages: { title, message } };
  }

  public async run(
    input: LlmTestcaseRunnerParams,
    bgProblem: BackgroundProblem,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const { testcaseId } = input;
    const problemId = bgProblem.problemId;
    const problem = bgProblem.problem;

    token.onCancellationRequested(() => {
      this.stopTestcases.exec({ type: 'stopTestcases', problemId, onlyOne: false });
    });

    if (testcaseId !== undefined) {
      await this.runSingleTestcase.exec({
        type: 'runTestcase',
        problemId,
        testcaseId,
        forceCompile: null,
      });
    } else {
      await this.runAllTestcases.exec({
        type: 'runTestcases',
        problemId,
        forceCompile: null,
      });
    }

    // Collect results for a summary
    const relevantIds = testcaseId ? [testcaseId] : problem.testcaseOrder;
    const summary = relevantIds.map((testcaseId) => {
      const testcase = problem.getTestcase(testcaseId);
      const verdict = testcase.verdict;
      return {
        testcaseId,
        verdict: verdict ? Verdicts[verdict].name : 'NOT_RUN',
        timeMs: testcase.timeMs,
        memoryMb: testcase.memoryMb,
      };
    });

    return this.createResult({ summary });
  }
}

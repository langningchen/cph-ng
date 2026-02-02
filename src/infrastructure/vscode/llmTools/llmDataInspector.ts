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

import type { UUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import type {
  CancellationToken,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  PreparedToolInvocation,
} from 'vscode';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Verdicts } from '@/domain/entities/verdict';
import { BaseLlmTool, type BaseLlmToolParams } from './baseLlmTool';

type DataType = 'stdin' | 'answer' | 'stdout' | 'stderr' | 'meta';
interface LlmDataInspectorParams extends BaseLlmToolParams {
  testcaseId: UUID;
  dataType?: DataType | 'all';
}

@injectable()
export class LlmDataInspector extends BaseLlmTool<LlmDataInspectorParams> {
  public constructor(
    @inject(TOKENS.problemRepository) repo: IProblemRepository,
    @inject(TOKENS.activePathService) activePathService: IActivePathService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
  ) {
    super(repo, activePathService);
  }

  public async prepareInvocation(
    { input }: LanguageModelToolInvocationPrepareOptions<LlmDataInspectorParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    const { dataType = 'all', testcaseId } = input;
    return {
      invocationMessage: this.translator.t('Inspecting {dataType} for test case {testcaseId}...', {
        dataType,
        testcaseId,
      }),
    };
  }

  public async run(
    input: LlmDataInspectorParams,
    bgProblem: BackgroundProblem,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const { dataType = 'all', testcaseId } = input;
    const problem = bgProblem.problem;
    const testcase = problem.testcases.get(testcaseId);
    if (!testcase) {
      return this.createResult(`Error: Test case ${testcaseId} not found.`);
    }

    const notRunMsg = '(Test case not run yet)';

    if (dataType === 'all') {
      const info = testcase.verdict ? Verdicts[testcase.verdict] : undefined;
      return this.createResult({
        verdict: info ? info.name : 'NOT_RUN',
        timeMs: testcase.timeMs,
        memoryMb: testcase.memoryMb,
        message: testcase.msg,
        stdin: await this.testcaseIoService.readContent(testcase.stdin),
        answer: await this.testcaseIoService.readContent(testcase.answer),
        stdout: testcase.stdout ? await this.testcaseIoService.readContent(testcase.stdout) : null,
        stderr: testcase.stderr ? await this.testcaseIoService.readContent(testcase.stderr) : null,
      });
    }

    const handlers: Record<DataType, () => Promise<unknown> | unknown> = {
      stdin: () => this.testcaseIoService.readContent(testcase.stdin),
      answer: () => this.testcaseIoService.readContent(testcase.answer),
      stdout: () =>
        testcase.stdout ? this.testcaseIoService.readContent(testcase.stdout) : notRunMsg,
      stderr: () =>
        testcase.stderr ? this.testcaseIoService.readContent(testcase.stderr) : notRunMsg,
      meta: () => {
        const verdict = testcase.verdict;
        if (!verdict) return notRunMsg;
        const info = Verdicts[verdict];
        return {
          verdict: info.name,
          timeMs: testcase.timeMs,
          memoryMb: testcase.memoryMb,
          message: testcase.msg,
        };
      },
    };

    return this.createResult(await handlers[dataType as keyof typeof handlers]());
  }
}

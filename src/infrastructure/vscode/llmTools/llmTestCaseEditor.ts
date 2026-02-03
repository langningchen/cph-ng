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
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { TestcaseId } from '@/domain/types';
import { BaseLlmTool, type BaseLlmToolParams } from './baseLlmTool';

interface LlmTestcaseEditorParams extends BaseLlmToolParams {
  testcaseId?: TestcaseId;
  stdin?: string;
  answer?: string;
  isDisabled?: boolean;
}

@injectable()
export class LlmTestcaseEditor extends BaseLlmTool<LlmTestcaseEditorParams> {
  public constructor(
    @inject(TOKENS.problemRepository) repo: IProblemRepository,
    @inject(TOKENS.activePathService) activePathService: IActivePathService,
    @inject(TOKENS.translator) public readonly translator: ITranslator,
    @inject(TOKENS.crypto) public readonly crypto: ICrypto,
  ) {
    super(repo, activePathService);
  }

  public async prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<LlmTestcaseEditorParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    const { testcaseId, stdin, answer, isDisabled } = options.input;
    const op = testcaseId
      ? this.translator.t('Update test case {testcaseId}', { testcaseId })
      : this.translator.t('Create a new test case');
    const fields: string[] = [];
    if (stdin !== undefined) fields.push('stdin');
    if (answer !== undefined) fields.push('answer');
    if (isDisabled !== undefined) fields.push('isDisabled');

    return {
      invocationMessage: this.translator.t('{op}: {fields}', {
        op,
        fields: fields.join(', ') || this.translator.t('(no fields)'),
      }),
      confirmationMessages: {
        title: this.translator.t('Upsert Test Case'),
        message: testcaseId
          ? this.translator.t('Do you want to update test case {testcaseId}?', { testcaseId })
          : this.translator.t('Do you want to create a new test case?'),
      },
    };
  }

  public async run(
    input: LlmTestcaseEditorParams,
    bgProblem: BackgroundProblem,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const { testcaseId, stdin, answer, isDisabled } = input;
    const problem = bgProblem.problem;

    if (stdin === undefined && answer === undefined && isDisabled === undefined)
      return this.createResult(
        'Error: At least one of stdin, answer, or isDisabled must be provided.',
      );

    if (testcaseId) {
      const testcase = problem.testcases.get(testcaseId);
      if (!testcase) return this.createResult(`Error: Test case ${testcaseId} not found.`);

      if (stdin !== undefined) testcase.stdin = new TestcaseIo({ data: stdin });
      if (answer !== undefined) testcase.answer = new TestcaseIo({ data: answer });
      if (isDisabled !== undefined && isDisabled !== testcase.isDisabled)
        testcase.isDisabled = isDisabled;

      testcase.clearResult();
      await this.repo.persist(bgProblem.problemId);
      return this.createResult({ success: true });
    }

    const newTestcaseId = this.crypto.randomUUID() as TestcaseId;
    const newTestcase = new Testcase(
      new TestcaseIo({ data: stdin ?? '' }),
      new TestcaseIo({ data: answer ?? '' }),
      true,
    );
    if (isDisabled) newTestcase.isDisabled = true;

    problem.addTestcase(newTestcaseId, newTestcase);
    await this.repo.persist(bgProblem.problemId);
    return this.createResult({ success: true, newTestcaseId });
  }
}

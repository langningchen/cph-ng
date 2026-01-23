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

import {
  type CancellationToken,
  LanguageModelTextPart,
  type LanguageModelTool,
  type LanguageModelToolInvocationOptions,
  type LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  l10n,
  type PreparedToolInvocation,
} from 'vscode';
import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';

interface LlmTestcaseListerParams {
  activePath: string;
}

class LlmTestcaseLister implements LanguageModelTool<LlmTestcaseListerParams> {
  async prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<LlmTestcaseListerParams>,
    _token: CancellationToken,
  ): Promise<PreparedToolInvocation> {
    return {
      invocationMessage: l10n.t('Collecting CPH-NG test case identifiers...'),
      confirmationMessages: {
        title: l10n.t('List Test Cases'),
        message: l10n.t(
          'Do you want to list all available test case IDs for the current problem?',
        ),
      },
    };
  }

  async invoke(
    options: LanguageModelToolInvocationOptions<LlmTestcaseListerParams>,
    _token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    const result = new LanguageModelToolResult([]);
    const repo = container.resolve(TOKENS.problemRepository);
    const activePath = options.input.activePath;
    const bgProblem = await repo.get(activePath);
    if (!bgProblem) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t(
            'Error: No competitive programming problem found. Please ask the user to open or create a problem first.',
          ),
        ),
      );
      return result;
    }

    const problem = bgProblem.problem;
    if (problem.testcaseOrder.length === 0) {
      result.content.push(
        new LanguageModelTextPart(
          l10n.t('No test cases are currently defined for this problem.'),
        ),
      );
      return result;
    }

    const lines: string[] = [];
    lines.push(
      l10n.t('Total test cases: {count}', {
        count: problem.testcaseOrder.length,
      }),
    );
    lines.push('');
    problem.testcaseOrder.forEach((testcaseId) => {
      const testcase = problem.testcases[testcaseId];
      const verdict = testcase.result?.verdict;
      lines.push(
        l10n.t('- {id} - Verdict: {verdict}, Time: {time}, Memory: {memory}', {
          id: testcaseId,
          verdict: verdict
            ? `${verdict.name} (${verdict.fullName})`
            : l10n.t('Not run yet'),
          time: testcase.result ? `${testcase.result.time}ms` : 'N/A',
          memory: testcase.result ? `${testcase.result.memory}KB` : 'N/A',
        }),
      );
    });

    result.content.push(new LanguageModelTextPart(lines.join('\n')));
    return result;
  }
}

export default LlmTestcaseLister;

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

import {
    CancellationToken,
    l10n,
    LanguageModelTextPart,
    LanguageModelTool,
    LanguageModelToolInvocationOptions,
    LanguageModelToolInvocationPrepareOptions,
    LanguageModelToolResult,
    PreparedToolInvocation,
} from 'vscode';
import ProblemsManager from '../modules/problems/manager';

interface LlmTestCaseListerParams {
    activePath: string;
}

class LlmTestCaseLister implements LanguageModelTool<LlmTestCaseListerParams> {
    async prepareInvocation(
        _options: LanguageModelToolInvocationPrepareOptions<LlmTestCaseListerParams>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        return {
            invocationMessage: l10n.t(
                'Collecting CPH-NG test case identifiers...',
            ),
            confirmationMessages: {
                title: l10n.t('List Test Cases'),
                message: l10n.t(
                    'Do you want to list all available test case IDs for the current problem?',
                ),
            },
        };
    }

    async invoke(
        options: LanguageModelToolInvocationOptions<LlmTestCaseListerParams>,
        _token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const result = new LanguageModelToolResult([]);
        const activePath = options.input.activePath;
        const bgProblem = await ProblemsManager.getFullProblem(activePath);
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
        if (problem.tcOrder.length === 0) {
            result.content.push(
                new LanguageModelTextPart(
                    l10n.t(
                        'No test cases are currently defined for this problem.',
                    ),
                ),
            );
            return result;
        }

        const lines: string[] = [];
        lines.push(
            l10n.t('Total test cases: {count}', {
                count: problem.tcOrder.length,
            }),
        );
        lines.push('');
        problem.tcOrder.forEach((tcId) => {
            const tc = problem.tcs[tcId];
            const verdict = tc.result?.verdict;
            lines.push(
                l10n.t(
                    '- {id} - Verdict: {verdict}, Time: {time}, Memory: {memory}',
                    {
                        id: tcId,
                        verdict: verdict
                            ? `${verdict.name} (${verdict.fullName})`
                            : l10n.t('Not run yet'),
                        time: tc.result ? `${tc.result.time}ms` : 'N/A',
                        memory: tc.result ? `${tc.result.memory}KB` : 'N/A',
                    },
                ),
            );
        });

        result.content.push(new LanguageModelTextPart(lines.join('\n')));
        return result;
    }
}

export default LlmTestCaseLister;

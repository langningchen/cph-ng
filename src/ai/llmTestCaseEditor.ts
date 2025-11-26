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

import { Tc, TcIo } from '@/types';
import { UUID } from 'crypto';
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

interface LlmTestCaseEditorParams {
    activePath: string;
    id?: UUID;
    stdin?: string;
    answer?: string;
}

class LlmTestCaseEditor implements LanguageModelTool<LlmTestCaseEditorParams> {
    async prepareInvocation(
        options: LanguageModelToolInvocationPrepareOptions<LlmTestCaseEditorParams>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const { id, stdin, answer } = options.input;
        const op = id
            ? l10n.t('Update test case {id}', { id })
            : l10n.t('Create a new test case');
        const fields: string[] = [];
        if (stdin !== undefined) {
            fields.push('stdin');
        }
        if (answer !== undefined) {
            fields.push('answer');
        }

        return {
            invocationMessage: l10n.t('{op}: {fields}', {
                op,
                fields: fields.join(', ') || l10n.t('(no fields)'),
            }),
            confirmationMessages: {
                title: l10n.t('Upsert Test Case'),
                message: id
                    ? l10n.t('Do you want to update test case {id}?', { id })
                    : l10n.t('Do you want to create a new test case?'),
            },
        };
    }

    async invoke(
        options: LanguageModelToolInvocationOptions<LlmTestCaseEditorParams>,
        _token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const { id, stdin, answer } = options.input;
        const result = new LanguageModelToolResult([]);

        if (stdin === undefined && answer === undefined) {
            result.content.push(
                new LanguageModelTextPart(
                    l10n.t(
                        'Error: At least one of stdin or answer must be provided.',
                    ),
                ),
            );
            return result;
        }

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

        try {
            if (id) {
                if (typeof id !== 'string' || !id.trim()) {
                    result.content.push(
                        new LanguageModelTextPart(
                            l10n.t(
                                'Error: Test case identifier must be a non-empty string.',
                            ),
                        ),
                    );
                    return result;
                }
                const tc = problem.tcs[id];
                if (!tc) {
                    result.content.push(
                        new LanguageModelTextPart(
                            l10n.t('Error: Test case {id} not found.', { id }),
                        ),
                    );
                    return result;
                }

                if (stdin !== undefined) {
                    tc.stdin = new TcIo(false, stdin);
                }
                if (answer !== undefined) {
                    tc.answer = new TcIo(false, answer);
                }
                // Clear previous execution result so it can be re-run
                tc.result = undefined;
                await ProblemsManager.updateTc({
                    type: 'updateTc',
                    activePath,
                    id,
                    tc,
                });

                result.content.push(
                    new LanguageModelTextPart(
                        l10n.t('Test case {id} updated successfully.', { id }),
                    ),
                );
                return result;
            }

            const newId = problem.addTc(
                new Tc(
                    new TcIo(false, stdin ?? ''),
                    new TcIo(false, answer ?? ''),
                    true,
                ),
            );
            await ProblemsManager.dataRefresh();

            result.content.push(
                new LanguageModelTextPart(
                    l10n.t('Created new test case {id}', { id: newId }),
                ),
            );
            return result;
        } catch (e: any) {
            result.content.push(
                new LanguageModelTextPart(
                    l10n.t('Failed to upsert test case: {msg}', {
                        msg: e?.message ?? String(e),
                    }),
                ),
            );
            return result;
        }
    }
}

export default LlmTestCaseEditor;

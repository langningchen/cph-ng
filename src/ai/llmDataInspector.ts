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

import { TcIo } from '@/types';
import { UUID } from 'crypto';
import { readFile } from 'fs/promises';
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

const MAX_PREVIEW_LENGTH = 1000;

const formatContent = (payload: string): string => {
    if (!payload.length) {
        return l10n.t('(<empty>)');
    }
    const truncated =
        payload.length > MAX_PREVIEW_LENGTH
            ? payload.substring(0, MAX_PREVIEW_LENGTH) +
              '... ' +
              l10n.t('(truncated)')
            : payload;
    return '\n```\n' + truncated + '\n```';
};

const cloneInline = (io: TcIo | undefined): string | undefined => {
    if (!io) {
        return undefined;
    }
    if (io.useFile) {
        return undefined;
    }
    return io.data;
};

const readFromTcIo = async (io: TcIo): Promise<string> => {
    if (io.useFile) {
        const content = await readFile(io.data, 'utf-8');
        return content;
    }
    return io.data;
};

type DataType =
    | 'stdin'
    | 'answer'
    | 'stdout'
    | 'stderr'
    | 'verdict'
    | 'message'
    | 'time'
    | 'memory';

interface LlmDataInspectorParams {
    activePath: string;
    dataType: DataType;
    id: UUID;
}

class LlmDataInspector implements LanguageModelTool<LlmDataInspectorParams> {
    async prepareInvocation(
        options: LanguageModelToolInvocationPrepareOptions<LlmDataInspectorParams>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const { dataType, id } = options.input;
        return {
            invocationMessage: l10n.t(
                'Inspecting {type} for test case {id}...',
                {
                    type: dataType,
                    id,
                },
            ),
            confirmationMessages: {
                title: l10n.t('Inspect Test Case Data'),
                message: l10n.t(
                    'Do you want to read the {type} data for test case {id}?',
                    { type: dataType, id },
                ),
            },
        };
    }

    async invoke(
        options: LanguageModelToolInvocationOptions<LlmDataInspectorParams>,
        _token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const { dataType, id } = options.input;
        const result = new LanguageModelToolResult([]);

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
        const tc = problem.tcs[id];
        if (!tc) {
            result.content.push(
                new LanguageModelTextPart(
                    l10n.t('Error: Test case {id} not found.', { id }),
                ),
            );
            return result;
        }

        const pushText = (text: string) => {
            result.content.push(new LanguageModelTextPart(text));
        };

        const ensureResult = () => {
            if (!tc.result) {
                pushText(
                    l10n.t(
                        'Error: Result data for test case {id} is not available yet. Please run the test case first.',
                        { id },
                    ),
                );
                return false;
            }
            return true;
        };

        try {
            switch (dataType) {
                case 'stdin': {
                    const content = await readFromTcIo(tc.stdin);
                    pushText(
                        l10n.t('Input for test case {id}:{content}', {
                            id,
                            content: formatContent(content),
                        }),
                    );
                    break;
                }
                case 'answer': {
                    const content = await readFromTcIo(tc.answer);
                    pushText(
                        l10n.t('Expected output for test case {id}:{content}', {
                            id,
                            content: formatContent(content),
                        }),
                    );
                    break;
                }
                case 'stdout': {
                    if (!ensureResult()) {
                        break;
                    }
                    const io = tc.result!.stdout;
                    const inline = cloneInline(io);
                    if (inline !== undefined) {
                        pushText(
                            l10n.t(
                                'Program output for test case {id}:{content}',
                                {
                                    id,
                                    content: formatContent(inline),
                                },
                            ),
                        );
                    } else if (io.useFile) {
                        const content = await readFromTcIo(io);
                        pushText(
                            l10n.t(
                                'Program output for test case {id}:{content}',
                                {
                                    id,
                                    content: formatContent(content),
                                },
                            ),
                        );
                    } else {
                        pushText(
                            l10n.t(
                                'Program output for test case {id} is unavailable.',
                                {
                                    id,
                                },
                            ),
                        );
                    }
                    break;
                }
                case 'stderr': {
                    if (!ensureResult()) {
                        break;
                    }
                    const io = tc.result!.stderr;
                    const inline = cloneInline(io);
                    if (inline !== undefined) {
                        pushText(
                            l10n.t(
                                'Error output for test case {id}:{content}',
                                {
                                    id,
                                    content: formatContent(inline),
                                },
                            ),
                        );
                    } else if (io.useFile) {
                        const content = await readFromTcIo(io);
                        pushText(
                            l10n.t(
                                'Error output for test case {id}:{content}',
                                {
                                    id,
                                    content: formatContent(content),
                                },
                            ),
                        );
                    } else {
                        pushText(
                            l10n.t(
                                'Error output for test case {id} is unavailable.',
                                {
                                    id,
                                },
                            ),
                        );
                    }
                    break;
                }
                case 'verdict': {
                    if (!ensureResult()) {
                        break;
                    }
                    const verdict = tc.result!.verdict;
                    pushText(
                        l10n.t('Verdict for test case {id}: {name} ({full})', {
                            id,
                            name: verdict.name,
                            full: verdict.fullName,
                        }),
                    );
                    break;
                }
                case 'message': {
                    if (!ensureResult()) {
                        break;
                    }
                    const msg = tc.result!.msg;
                    pushText(
                        msg
                            ? l10n.t('Message for test case {id}: {msg}', {
                                  id,
                                  msg,
                              })
                            : l10n.t('Message for test case {id} is empty.', {
                                  id,
                              }),
                    );
                    break;
                }
                case 'time': {
                    if (!ensureResult()) {
                        break;
                    }
                    pushText(
                        l10n.t('Execution time for test case {id}: {time}ms', {
                            id,
                            time: tc.result!.time,
                        }),
                    );
                    break;
                }
                case 'memory': {
                    if (!ensureResult()) {
                        break;
                    }
                    const mem = tc.result!.memory;
                    if (mem === undefined) {
                        pushText(
                            l10n.t(
                                'Memory usage for test case {id} is unavailable.',
                                {
                                    id,
                                },
                            ),
                        );
                    } else {
                        pushText(
                            l10n.t('Memory usage for test case {id}: {mem}KB', {
                                id,
                                mem,
                            }),
                        );
                    }
                    break;
                }
                default:
                    pushText(
                        l10n.t('Error: Unsupported data type {type}', {
                            type: dataType,
                        }),
                    );
            }
        } catch (e: any) {
            pushText(
                l10n.t('Error while reading data: {msg}', {
                    msg: e?.message ?? String(e),
                }),
            );
        }

        return result;
    }
}

export default LlmDataInspector;

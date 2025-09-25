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

import { access, readFile, writeFile } from 'fs/promises';
import { createServer, Server } from 'http';
import * as vscode from 'vscode';
import FolderChooser from '../helpers/folderChooser';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import { renderTemplate } from '../utils/strTemplate';
import { Problem } from '../utils/types';
import CphCapable, { CphProblem } from './cphCapable';
import CphNg from './cphNg';
import ExtensionManager from './extensionManager';
import Settings from './settings';

type OnCreateProblem = (
    problem: Problem,
    document: vscode.TextDocument,
) => void;

type CphSubmitEmpty = {
    empty: true;
};
type CphSubmitData = {
    empty: false;
    problemName: string;
    url: string;
    sourceCode: string;
    languageId: number;
};
type CphSubmitResponse = CphSubmitEmpty | CphSubmitData;

class Companion {
    private static logger: Logger = new Logger('companion');
    static server: Server;
    private static isSubmitting = false;
    private static pendingSubmitData?: Exclude<
        CphSubmitResponse,
        { empty: true }
    >;
    private static pendingSubmitResolve?: () => void;

    public static init() {
        Companion.logger.trace('init');
        Companion.server = createServer((request, response) => {
            let requestData = '';

            request.on('data', (chunk) => {
                requestData += chunk;
            });

            request.on('close', async () => {
                Companion.logger.debug('Received request', requestData);
                if (request.url === '/') {
                    await Companion.processProblem(requestData);
                    response.statusCode = 200;
                } else if (request.url === '/getSubmit') {
                    response.statusCode = 200;
                    response.write(
                        JSON.stringify(await Companion.processSubmit()),
                    );
                } else {
                    response.statusCode = 404;
                }
                response.end(() => {
                    if (request.url === '/getSubmit') {
                        Companion.pendingSubmitResolve?.();
                    }
                });
            });
        });

        Companion.server.on('error', (e) => {
            Companion.logger.error('Server error occurred', e);
            Io.error(
                vscode.l10n.t('Failed to start companion server: {msg}.', {
                    msg: e.message,
                }),
            );
        });

        Companion.logger.info(
            'Companion server listen at port',
            Settings.companion.listenPort,
        );
        Companion.server.listen(Settings.companion.listenPort);
    }

    public static dispose() {
        Companion.logger.trace('dispose');
        Companion.server.close();
    }

    private static async processProblem(requestData: string) {
        if (requestData.trim() === '') {
            Companion.logger.warn('Empty request data, ignoring');
            return;
        }
        Companion.logger.trace('processProblem', { requestData });
        try {
            const problem = CphCapable.toProblem(
                JSON.parse(requestData) satisfies CphProblem,
            );
            const folder = Settings.companion.chooseSaveFolder
                ? await FolderChooser.chooseFolder(
                      vscode.l10n.t(
                          'Select a folder to save the problem source file',
                      ),
                  )
                : vscode.workspace.workspaceFolders?.[0].uri;

            if (!folder) {
                Companion.logger.warn('No folder selected');
                Io.info(
                    vscode.l10n.t(
                        'No folder selected, problem creation cancelled.',
                    ),
                );
                return;
            }

            Companion.logger.trace('Using folder', { folder });
            problem.src = {
                path: vscode.Uri.joinPath(
                    folder,
                    Companion.getProblemFileName(problem.name, problem.url),
                ).fsPath,
            };
            Companion.logger.info(
                'Created problem source path',
                problem.src.path,
            );

            try {
                await access(problem.src.path);
                Companion.logger.debug('Source file already exists', {
                    srcPath: problem.src.path,
                });
            } catch {
                Companion.logger.info('Creating new source file', {
                    srcPath: problem.src.path,
                });
                await Companion.createSourceFile(problem);
            }

            const document = await vscode.workspace.openTextDocument(
                problem.src.path,
            );
            Companion.logger.info('Opened document', {
                document: document.fileName,
            });
            CphNg.problem = problem;
            await CphNg.saveProblem(problem);
            await vscode.window.showTextDocument(
                document,
                Settings.companion.showPanel,
            );
            ExtensionManager.updateContext();
        } catch (e) {
            Companion.logger.warn('Parse data from companion failed', e);
            Io.warn(
                vscode.l10n.t('Parse data from companion failed: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }

    public static async submit(problem?: Problem): Promise<void> {
        Companion.logger.trace('submit', { problem });
        if (!problem) {
            return;
        }
        const languageList = {
            'GNU G++17 7.3.0': 54,
            'GNU G++20 13.2 (64 bit, winlibs)': 89,
            'GNU G++23 14.2 (64 bit, msys2)': 91,
        };
        if (Companion.isSubmitting) {
            Io.warn(vscode.l10n.t('A submission is already in progress.'));
            return Promise.reject(new Error('Submission already in progress'));
        }

        let submitLanguageId = Settings.companion.submitLanguage;
        if (!Object.values(languageList).includes(submitLanguageId)) {
            const choice = await vscode.window.showQuickPick(
                Object.keys(languageList),
                { placeHolder: vscode.l10n.t('Choose submission language') },
            );
            if (!choice) {
                Io.info(vscode.l10n.t('Submission cancelled.'));
                return;
            }
            submitLanguageId =
                languageList[choice as keyof typeof languageList];
            Settings.companion.submitLanguage = submitLanguageId;
        }

        const sourceCode = await readFile(problem.src.path, 'utf-8');
        Companion.logger.info('Read source code for submission', {
            srcPath: problem.src.path,
            sourceCode,
        });
        if (sourceCode.trim() === '') {
            Io.warn(
                vscode.l10n.t('Source code is empty. Submission cancelled.'),
            );
            return;
        }
        const requestData: Exclude<CphSubmitResponse, { empty: true }> = {
            empty: false,
            problemName: problem.name,
            url: problem.url || '',
            sourceCode:
                sourceCode +
                (Settings.companion.addTimestamp
                    ? `\n// Submitted via cph-ng at ${new Date().toISOString()}`
                    : ''),
            languageId: submitLanguageId,
        };
        Companion.logger.debug('Submission data', requestData);

        Companion.isSubmitting = true;
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Waiting response from cph-submit...'),
                cancellable: true,
            },
            async (_, token) =>
                new Promise<void>((resolve, _) => {
                    Companion.pendingSubmitData = requestData;

                    const cleanup = () => {
                        Companion.isSubmitting = false;
                        Companion.pendingSubmitData = undefined;
                        Companion.pendingSubmitResolve = undefined;
                    };
                    Companion.pendingSubmitResolve = () => {
                        Companion.logger.info(
                            'Submission payload consumed by companion',
                        );
                        cleanup();
                        resolve();
                    };

                    token.onCancellationRequested(() => {
                        Io.warn(vscode.l10n.t('Submission cancelled.'));
                        cleanup();
                        resolve();
                    });
                }),
        );
    }

    private static async processSubmit(): Promise<CphSubmitResponse> {
        Companion.logger.trace('processSubmit');
        const data = Companion.pendingSubmitData;
        if (data) {
            Companion.logger.debug('Pending submission data found', data);
            Companion.logger.info('Serving pending submission to companion');
            Companion.pendingSubmitData = undefined;
            return data;
        }
        Companion.logger.trace('No pending submission data');
        return { empty: true };
    }

    private static async createSourceFile(problem: Problem): Promise<void> {
        Companion.logger.trace('createSourceFile', {
            problem,
        });
        try {
            if (Settings.problem.templateFile) {
                Companion.logger.info('Using template file', {
                    templateFile: Settings.problem.templateFile,
                });
                try {
                    const template = await readFile(
                        Settings.problem.templateFile,
                        'utf-8',
                    );
                    const renderedTemplate = renderTemplate(template, [
                        ['title', problem.name],
                        ['timeLimit', problem.timeLimit.toString()],
                        ['url', problem.url || ''],
                    ]);
                    await writeFile(problem.src.path, renderedTemplate);
                    Companion.logger.info('Template applied successfully', {
                        srcPath: problem.src.path,
                    });
                } catch (e) {
                    Companion.logger.warn('Template file error', e);
                    Io.warn(
                        vscode.l10n.t(
                            'Failed to use template file: {msg}, creating empty file instead',
                            { msg: (e as Error).message },
                        ),
                    );
                    await writeFile(problem.src.path, '');
                    Companion.logger.info('Created empty source file', {
                        srcPath: problem.src.path,
                    });
                }
            } else {
                Companion.logger.info(
                    'No template file configured, creating empty file',
                );
                await writeFile(problem.src.path, '');
            }
        } catch (e) {
            Companion.logger.error('Failed to create source file', e);
            throw new Error(
                `Failed to create source file: ${(e as Error).message}`,
            );
        }
    }

    private static getProblemFileName(name: string, url?: string) {
        const ext: string = 'cpp'; // TODO: get from user settings
        Companion.logger.trace('getProblemFileName', { name, url, ext });
        const { shortCodeforcesName, shortLuoguName, shortAtCoderName } =
            Settings.companion;
        if (url) {
            try {
                const u = new URL(url);
                if (u.host.includes('codeforces.com') && shortCodeforcesName) {
                    const regexPatterns = [
                        /\/contest\/(\d+)\/problem\/(\w+)/,
                        /\/problemset\/problem\/(\d+)\/(\w+)/,
                        /\/gym\/(\d+)\/problem\/(\w+)/,
                    ];
                    for (const regex of regexPatterns) {
                        const match = url.match(regex);
                        if (match) {
                            return `${match[1]}${match[2]}.${ext}`;
                        }
                    }
                }
                if (u.host.includes('luogu.com.cn') && shortLuoguName) {
                    const match = url.match(/problem\/(\w+)/);
                    if (match) {
                        return `${match[1]}.${ext}`;
                    }
                }
                if (u.host.includes('atcoder.jp') && shortAtCoderName) {
                    const match = url.match(/tasks\/(\w+)_(\w+)/);
                    if (match) {
                        return `${match[1]}${match[2]}.${ext}`;
                    }
                }
            } catch (e) {
                Companion.logger.warn(
                    `Failed to parse URL: ${url}. Error: ${(e as Error).message}`,
                    e,
                );
            }
        }
        const words = name.match(/[\p{L}]+|[0-9]+/gu);
        const fileName =
            (words ? `${words.join('_')}` : `${name.replace(/\W+/g, '_')}`) +
            `.${ext}`;
        Companion.logger.debug('Generated problem file name', {
            originalName: name,
            url,
            fileName,
        });
        return fileName;
    }
}

export default Companion;

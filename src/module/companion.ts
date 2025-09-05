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
import { join } from 'path';
import * as vscode from 'vscode';
import { CphCapable, CphProblem } from './cphCapable';
import { io, Logger } from '../utils/io';
import Settings from '../utils/settings';
import { renderTemplate } from '../utils/strTemplate';
import { Problem } from '../utils/types';
import { FolderChooser } from '../utils/folderChooser';

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
    private logger: Logger = new Logger('companion');
    server: Server;
    private isSubmitting = false;
    private pendingSubmitData?: Exclude<CphSubmitResponse, { empty: true }>;
    private pendingSubmitResolve?: () => void;

    constructor(onCreateProblem: OnCreateProblem) {
        this.logger.trace('constructor', {
            onCreateProblem,
        });
        this.server = createServer((request, response) => {
            let requestData = '';

            request.on('data', (chunk) => {
                requestData += chunk;
            });

            request.on('close', async () => {
                this.logger.debug('Received request', requestData);
                if (request.url === '/') {
                    await this.processProblem(requestData, onCreateProblem);
                    response.statusCode = 200;
                } else if (request.url === '/getSubmit') {
                    response.statusCode = 200;
                    response.write(JSON.stringify(await this.processSubmit()));
                } else {
                    response.statusCode = 404;
                }
                response.end(() => {
                    if (request.url === '/getSubmit') {
                        this.pendingSubmitResolve?.();
                    }
                });
            });
        });

        this.server.on('error', (e) => {
            this.logger.error('Server error occurred', e);
            io.error(
                vscode.l10n.t('Failed to start companion server: {msg}.', {
                    msg: e.message,
                }),
            );
        });

        this.logger.info(
            'Companion server listen at port',
            Settings.companion.listenPort,
        );
        this.server.listen(Settings.companion.listenPort);
    }

    public dispose() {
        this.logger.trace('dispose');
        this.server.close();
    }

    private async processProblem(
        requestData: string,
        onCreateProblem: OnCreateProblem,
    ) {
        if (requestData.trim() === '') {
            this.logger.warn('Empty request data, ignoring');
            return;
        }
        this.logger.trace('processProblem', { requestData });
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
                this.logger.warn('No folder selected');
                io.info(
                    vscode.l10n.t(
                        'No folder selected, problem creation cancelled.',
                    ),
                );
                return;
            }

            this.logger.trace('Using folder', { folder });
            problem.src = {
                path: vscode.Uri.joinPath(
                    folder,
                    this.getProblemFileName(problem.name),
                ).fsPath,
            };
            this.logger.info('Created problem source path', problem.src.path);

            try {
                await access(problem.src.path);
                this.logger.debug('Source file already exists', {
                    srcPath: problem.src.path,
                });
            } catch {
                this.logger.info('Creating new source file', {
                    srcPath: problem.src.path,
                });
                await this.createSourceFile(problem);
            }

            const document = await vscode.workspace.openTextDocument(
                problem.src.path,
            );
            this.logger.info('Opened document', {
                document: document.fileName,
            });
            onCreateProblem(problem, document);
        } catch (e) {
            this.logger.warn('Parse data from companion failed', e);
            io.warn(
                vscode.l10n.t('Parse data from companion failed: {msg}.', {
                    msg: (e as Error).message,
                }),
            );
        }
    }

    public async submit(problem?: Problem): Promise<void> {
        this.logger.trace('submit', { problem });
        if (!problem) {
            return;
        }
        const languageList = {
            'GNU G++17 7.3.0': 54,
            'GNU G++20 13.2 (64 bit, winlibs)': 89,
            'GNU G++23 14.2 (64 bit, msys2)': 91,
        };
        if (this.isSubmitting) {
            io.warn(vscode.l10n.t('A submission is already in progress.'));
            return Promise.reject(new Error('Submission already in progress'));
        }

        let submitLanguageId = Settings.companion.submitLanguage;
        if (!Object.values(languageList).includes(submitLanguageId)) {
            const choice = await vscode.window.showQuickPick(
                Object.keys(languageList),
                { placeHolder: vscode.l10n.t('Choose submission language') },
            );
            if (!choice) {
                io.info(vscode.l10n.t('Submission cancelled.'));
                return;
            }
            submitLanguageId =
                languageList[choice as keyof typeof languageList];
            Settings.companion.submitLanguage = submitLanguageId;
        }

        const sourceCode = await readFile(problem.src.path, 'utf-8');
        this.logger.info('Read source code for submission', {
            srcPath: problem.src.path,
            sourceCode,
        });
        if (sourceCode.trim() === '') {
            io.warn(
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
        this.logger.debug('Submission data', requestData);

        this.isSubmitting = true;
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Waiting response from cph-submit...'),
                cancellable: true,
            },
            async (_, token) =>
                new Promise<void>((resolve, _) => {
                    this.pendingSubmitData = requestData;

                    const cleanup = () => {
                        this.isSubmitting = false;
                        this.pendingSubmitData = undefined;
                        this.pendingSubmitResolve = undefined;
                    };
                    this.pendingSubmitResolve = () => {
                        this.logger.info(
                            'Submission payload consumed by companion',
                        );
                        cleanup();
                        resolve();
                    };

                    token.onCancellationRequested(() => {
                        io.warn(vscode.l10n.t('Submission cancelled.'));
                        cleanup();
                        resolve();
                    });
                }),
        );
    }

    private async processSubmit(): Promise<CphSubmitResponse> {
        this.logger.trace('processSubmit');
        const data = this.pendingSubmitData;
        if (data) {
            this.logger.debug('Pending submission data found', data);
            this.logger.info('Serving pending submission to companion');
            this.pendingSubmitData = undefined;
            return data;
        }
        this.logger.trace('No pending submission data');
        return { empty: true };
    }

    private async createSourceFile(problem: Problem): Promise<void> {
        this.logger.trace('createSourceFile', {
            problem,
        });
        try {
            if (Settings.problem.templateFile) {
                this.logger.info('Using template file', {
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
                    this.logger.info('Template applied successfully', {
                        srcPath: problem.src.path,
                    });
                } catch (e) {
                    this.logger.warn('Template file error', e);
                    io.warn(
                        vscode.l10n.t(
                            'Failed to use template file: {msg}, creating empty file instead',
                            { msg: (e as Error).message },
                        ),
                    );
                    await writeFile(problem.src.path, '');
                    this.logger.info('Created empty source file', {
                        srcPath: problem.src.path,
                    });
                }
            } else {
                this.logger.info(
                    'No template file configured, creating empty file',
                );
                await writeFile(problem.src.path, '');
            }
        } catch (e) {
            this.logger.error('Failed to create source file', e);
            throw new Error(
                `Failed to create source file: ${(e as Error).message}`,
            );
        }
    }

    private getProblemFileName(name: string) {
        this.logger.trace('getProblemFileName', {
            name,
        });
        const words = name.match(/[\p{L}]+|[0-9]+/gu);
        const fileName =
            (words ? `${words.join('_')}` : `${name.replace(/\W+/g, '_')}`) +
            '.cpp';
        this.logger.debug('Generated problem file name', {
            originalName: name,
            fileName,
        });
        return fileName;
    }
}

export default Companion;

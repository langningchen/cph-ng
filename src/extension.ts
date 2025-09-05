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

import { access, constants, mkdir, readFile, rm } from 'fs/promises';
import { extname, join } from 'path';
import * as vscode from 'vscode';
import Companion from './module/companion';
import { CphCapable } from './module/cphCapable';
import { CphNg } from './module/cphNg';
import { io, Logger } from './utils/io';
import Settings from './utils/settings';
import { SidebarProvider } from './module/sidebarProvider';
import { isRunningVerdict } from './utils/types';
import LlmTcRunner from './ai/llmTcRunner';
import LlmFileReader from './ai/llmFileReader';
import { setExtensionUri } from './utils/global';
import { Langs } from './core/langs/langs';

class ExtensionManager {
    private logger: Logger = new Logger('extension');
    private sidebarProvider!: SidebarProvider;
    private companion!: Companion;
    private cphNg!: CphNg;
    private fileTimer!: NodeJS.Timeout;
    private compatibleTimer!: NodeJS.Timeout;

    public async activate(context: vscode.ExtensionContext) {
        this.logger.info('Activating CPH-NG extension');
        try {
            setExtensionUri(context.extensionUri);
            if (Settings.cache.cleanOnStartup) {
                this.logger.info('Cleaning cache on startup');
                await rm(Settings.cache.directory, {
                    force: true,
                    recursive: true,
                });
            }

            await Promise.all([
                mkdir(join(Settings.cache.directory, 'bin'), {
                    recursive: true,
                }),
                mkdir(join(Settings.cache.directory, 'out'), {
                    recursive: true,
                }),
                mkdir(join(Settings.cache.directory, 'diff'), {
                    recursive: true,
                }),
                mkdir(join(Settings.cache.directory, 'io'), {
                    recursive: true,
                }),
            ]);
            this.logger.info('Cache directories created successfully');

            this.companion = new Companion(async (problem, document) => {
                this.logger.debug('Companion callback triggered', {
                    problemName: problem.name,
                    documentPath: document.fileName,
                });
                this.cphNg.problem = problem;
                await this.cphNg.saveProblem();
                await vscode.window.showTextDocument(
                    document,
                    Settings.companion.showPanel,
                );
                this.updateContext();
            });
            this.cphNg = new CphNg();
            this.cphNg.addProblemChangeListener(() => {
                this.logger.trace('Problem change detected');
                this.updateContext();
            });
            this.sidebarProvider = new SidebarProvider(
                this.cphNg,
                this.companion,
            );

            context.subscriptions.push(
                vscode.window.registerWebviewViewProvider(
                    SidebarProvider.viewType,
                    this.sidebarProvider satisfies vscode.WebviewViewProvider,
                    {
                        webviewOptions: {
                            retainContextWhenHidden:
                                Settings.sidebar.retainWhenHidden,
                        },
                    },
                ),
            );
            context.subscriptions.push(
                vscode.lm.registerTool(
                    'run_test_cases',
                    new LlmTcRunner(this.cphNg),
                ),
            );
            context.subscriptions.push(
                vscode.lm.registerTool(
                    'read_problem_file',
                    new LlmFileReader(this.cphNg),
                ),
            );
            context.subscriptions.push(
                vscode.window.onDidChangeActiveTextEditor(() => {
                    this.checkActiveFile();
                }),
            );

            this.fileTimer = setInterval(() => this.checkActiveFile(), 1000);
            context.subscriptions.push({
                dispose: () => clearInterval(this.fileTimer),
            });

            let lastAlertTime = 0;
            this.compatibleTimer = setInterval(async () => {
                const currentTime = new Date().getTime();
                if (
                    vscode.extensions.getExtension(
                        'divyanshuagrawal.competitive-programming-helper',
                    )?.isActive &&
                    currentTime - lastAlertTime > 5 * 1000
                ) {
                    lastAlertTime = currentTime;
                    const result = (await io.warn(
                        vscode.l10n.t(
                            "CPH-NG is can not run with CPH, but it can load CPH problem file. Please disable CPH to use CPH-NG. You can select the 'Ignore' option to ignore this warning in this session.",
                        ),
                        { modal: true },
                        { title: vscode.l10n.t('OK') },
                        { title: vscode.l10n.t('Ignore') },
                    )) satisfies vscode.MessageItem;
                    if (result.title === vscode.l10n.t('Ignore')) {
                        clearInterval(this.compatibleTimer);
                    }
                }
            }, 1000 * 60);
            context.subscriptions.push({
                dispose: () => clearInterval(this.compatibleTimer),
            });

            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.createProblem',
                    async () => {
                        this.sidebarProvider.focus();
                        await this.cphNg.createProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.importProblem',
                    async () => {
                        this.sidebarProvider.focus();
                        await this.cphNg.importProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.runTestCases',
                    async () => {
                        this.sidebarProvider.focus();
                        await this.cphNg.runTcs();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.stopTestCases',
                    async () => {
                        this.sidebarProvider.focus();
                        await this.cphNg.stopTcs(false);
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.addTestCase',
                    async () => {
                        await this.cphNg.addTc();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.loadTestCases',
                    async () => {
                        await this.cphNg.loadTcs();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.deleteProblem',
                    async () => {
                        await this.cphNg.delProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.submitToCodeforces',
                    async () => {
                        await this.companion.submit(this.cphNg.problem);
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.exportToEmbedded',
                    async () => {
                        await this.cphNg.exportToEmbedded();
                    },
                ),
            );

            this.updateContext();
            this.logger.info('CPH-NG extension activated successfully');
        } catch (e) {
            this.logger.error('Failed to activate extension', e);
            io.error(
                vscode.l10n.t('Failed to activate CPH-NG extension: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }

    public deactivate() {
        this.logger.info('Deactivating CPH-NG extension');
        this.companion.dispose();
        this.logger.info('CPH-NG extension deactivated');
    }

    private updateContext() {
        this.logger.trace('updateContext');
        const hasProblem = !!this.cphNg.problem;
        const canImport = this.cphNg.canImport;
        const isRunning =
            this.cphNg.problem?.tcs.some((tc) =>
                isRunningVerdict(tc.result?.verdict),
            ) || false;

        this.logger.debug('Context update', {
            hasProblem,
            canImport,
            isRunning,
        });
        vscode.commands.executeCommand(
            'setContext',
            'cph-ng.hasProblem',
            hasProblem,
        );
        vscode.commands.executeCommand(
            'setContext',
            'cph-ng.canImport',
            canImport,
        );
        vscode.commands.executeCommand(
            'setContext',
            'cph-ng.isRunning',
            isRunning,
        );
    }

    private async checkActiveFile() {
        this.logger.trace('checkActiveFile');
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.uri.scheme !== 'file') {
                return;
            }

            const filePath = editor.document.fileName;
            if (filePath.startsWith(Settings.cache.directory)) {
                return;
            }

            if (
                this.cphNg.problem?.tcs
                    .flatMap((tc) =>
                        [
                            tc.stdin.useFile ? [tc.stdin.path] : [],
                            tc.answer.useFile ? [tc.answer.path] : [],
                            tc.result?.stdout.useFile
                                ? [tc.result.stdout.path]
                                : [],
                            tc.result?.stderr.useFile
                                ? [tc.result.stderr.path]
                                : [],
                        ].flat(),
                    )
                    .includes(filePath)
            ) {
                this.logger.debug('Test case file is active', { filePath });
            } else if (this.cphNg.problem?.checker?.path === filePath) {
                this.logger.debug('Checker file is active', { filePath });
            } else if (
                this.cphNg.problem?.bfCompare?.bruteForce?.path === filePath
            ) {
                this.logger.debug('Brute force file is active', { filePath });
            } else if (
                this.cphNg.problem?.bfCompare?.generator?.path === filePath
            ) {
                this.logger.debug('Generator file is active', { filePath });
            } else if (Langs.getLang(filePath, true) !== undefined) {
                this.logger.debug('Source file is active', { filePath });
                if (this.cphNg.problem?.src.path !== filePath) {
                    this.logger.trace(
                        'Last source file',
                        this.cphNg.problem?.src.path,
                        'is not the current file',
                        { filePath },
                    );
                    await this.cphNg.loadProblem(filePath);
                    if (this.cphNg.problem === undefined) {
                        if (
                            !this.cphNg.problem &&
                            Settings.cphCapable.enabled
                        ) {
                            try {
                                await access(
                                    CphCapable.getProbByCpp(filePath),
                                    constants.R_OK,
                                );
                                this.cphNg.canImport = true;
                            } catch {
                                this.cphNg.canImport = false;
                            }
                        } else {
                            this.cphNg.canImport = false;
                        }
                        this.updateContext();
                    }
                }
            } else {
                this.cphNg.problem = undefined;
                this.cphNg.canImport = false;
                this.updateContext();
            }
        } catch (e) {
            io.error(
                vscode.l10n.t('Error in checkActiveFile: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
}

let extensionManager: ExtensionManager;

export function activate(context: vscode.ExtensionContext) {
    extensionManager = new ExtensionManager();
    extensionManager.activate(context);
}

export function deactivate() {
    extensionManager && extensionManager.deactivate();
}

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
import { release } from 'os';
import { join } from 'path';
import * as vscode from 'vscode';
import { version } from '../../package.json';
import LlmFileReader from '../ai/llmFileReader';
import LlmTcRunner from '../ai/llmTcRunner';
import Langs from '../core/langs/langs';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import Companion from '../modules/companion';
import CphCapable from '../modules/cphCapable';
import SidebarProvider from '../modules/sidebarProvider';
import { extensionPath, setExtensionUri } from '../utils/global';
import { isRunningVerdict } from '../utils/types';
import CphNg from './cphNg';
import Settings from './settings';

export default class ExtensionManager {
    private static logger: Logger = new Logger('extension');
    private static fileTimer: NodeJS.Timeout;
    private static compatibleTimer: NodeJS.Timeout;

    public static async activate(context: vscode.ExtensionContext) {
        ExtensionManager.logger.info('Activating CPH-NG extension');
        try {
            setExtensionUri(context.extensionUri);
            if (Settings.cache.cleanOnStartup) {
                ExtensionManager.logger.info('Cleaning cache on startup');
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
            ExtensionManager.logger.info(
                'Cache directories created successfully',
            );

            Companion.init();
            CphNg.addProblemChangeListener(() => {
                ExtensionManager.logger.trace('Problem change detected');
                ExtensionManager.updateContext();
            });

            const sidebarProvider = new SidebarProvider();
            context.subscriptions.push(
                vscode.window.registerWebviewViewProvider(
                    SidebarProvider.viewType,
                    sidebarProvider,
                    {
                        webviewOptions: {
                            retainContextWhenHidden:
                                Settings.sidebar.retainWhenHidden,
                        },
                    },
                ),
            );
            context.subscriptions.push(
                vscode.lm.registerTool('run_test_cases', new LlmTcRunner()),
            );
            context.subscriptions.push(
                vscode.lm.registerTool(
                    'read_problem_file',
                    new LlmFileReader(),
                ),
            );
            context.subscriptions.push(
                vscode.window.onDidChangeActiveTextEditor(() => {
                    ExtensionManager.checkActiveFile();
                }),
            );

            ExtensionManager.fileTimer = setInterval(
                () => ExtensionManager.checkActiveFile(),
                1000,
            );
            context.subscriptions.push({
                dispose: () => clearInterval(ExtensionManager.fileTimer),
            });

            let lastAlertTime = 0;
            ExtensionManager.compatibleTimer = setInterval(async () => {
                const currentTime = Date.now();
                if (
                    vscode.extensions.getExtension(
                        'divyanshuagrawal.competitive-programming-helper',
                    )?.isActive &&
                    currentTime - lastAlertTime > 5 * 1000
                ) {
                    lastAlertTime = currentTime;
                    const result = (await Io.warn(
                        vscode.l10n.t(
                            "CPH-NG cannot run with CPH, but it can load CPH problem file. Please disable CPH to use CPH-NG. You can select the 'Ignore' option to ignore this warning in this session.",
                        ),
                        { modal: true },
                        { title: vscode.l10n.t('OK') },
                        { title: vscode.l10n.t('Ignore') },
                    )) satisfies vscode.MessageItem | undefined;
                    if (result?.title === vscode.l10n.t('Ignore')) {
                        clearInterval(ExtensionManager.compatibleTimer);
                    }
                }
            }, 1000 * 60);
            context.subscriptions.push({
                dispose: () => clearInterval(ExtensionManager.compatibleTimer),
            });

            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.versionInfo',
                    async () => {
                        const generated = await readFile(
                            join(extensionPath, 'dist', 'generated.json'),
                            'utf8',
                        ).then((data) => JSON.parse(data));
                        const msg = `Version: ${version}
Commit: ${generated.commitHash}
Date: ${generated.buildTime}
Build By: ${generated.buildBy}
OS: ${release()}`;
                        const result = (await Io.info(
                            'CPH-NG',
                            { modal: true, detail: msg },
                            { title: vscode.l10n.t('Copy') },
                        )) satisfies vscode.MessageItem | undefined;
                        if (result?.title === vscode.l10n.t('Copy')) {
                            await vscode.env.clipboard.writeText(msg);
                        }
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.importFromCph',
                    async () => CphCapable.importFromCph(),
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.createProblem',
                    async () => {
                        sidebarProvider.focus();
                        await CphNg.createProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.importProblem',
                    async () => {
                        sidebarProvider.focus();
                        await CphNg.importProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.runTestCases',
                    async () => {
                        sidebarProvider.focus();
                        await CphNg.runTcs(null);
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.stopTestCases',
                    async () => {
                        sidebarProvider.focus();
                        await CphNg.stopTcs(false);
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.addTestCase',
                    async () => {
                        await CphNg.addTc();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.loadTestCases',
                    async () => {
                        await CphNg.loadTcs();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.deleteProblem',
                    async () => {
                        await CphNg.delProblem();
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.submitToCodeforces',
                    async () => {
                        await Companion.submit(CphNg.problem);
                    },
                ),
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'cph-ng.exportToEmbedded',
                    async () => {
                        await CphNg.exportToEmbedded();
                    },
                ),
            );

            ExtensionManager.updateContext();
            ExtensionManager.logger.info(
                'CPH-NG extension activated successfully',
            );
        } catch (e) {
            ExtensionManager.logger.error('Failed to activate extension', e);
            Io.error(
                vscode.l10n.t('Failed to activate CPH-NG extension: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }

    public static deactivate() {
        ExtensionManager.logger.info('Deactivating CPH-NG extension');
        Companion.dispose();
        ExtensionManager.logger.info('CPH-NG extension deactivated');
    }

    public static updateContext() {
        ExtensionManager.logger.trace('updateContext');
        const hasProblem = !!CphNg.problem;
        const canImport = CphNg.canImport;
        const isRunning =
            CphNg.problem?.tcs.some((tc) =>
                isRunningVerdict(tc.result?.verdict),
            ) || false;

        ExtensionManager.logger.debug('Context update', {
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

    private static async checkActiveFile() {
        ExtensionManager.logger.trace('checkActiveFile');
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                CphNg.problem = undefined;
                CphNg.canImport = false;
                ExtensionManager.updateContext();
                return;
            }
            if (editor.document.uri.scheme !== 'file') {
                return;
            }

            const filePath = editor.document.fileName;
            if (filePath.startsWith(Settings.cache.directory)) {
                ExtensionManager.logger.debug('Cache directory is active', {
                    filePath,
                });
            } else if (
                CphNg.problem?.tcs
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
                ExtensionManager.logger.debug('Test case file is active', {
                    filePath,
                });
            } else if (CphNg.problem?.checker?.path === filePath) {
                ExtensionManager.logger.debug('Checker file is active', {
                    filePath,
                });
            } else if (CphNg.problem?.interactor?.path === filePath) {
                ExtensionManager.logger.debug('Interactor file is active', {
                    filePath,
                });
            } else if (
                CphNg.problem?.bfCompare?.bruteForce?.path === filePath
            ) {
                ExtensionManager.logger.debug('Brute force file is active', {
                    filePath,
                });
            } else if (CphNg.problem?.bfCompare?.generator?.path === filePath) {
                ExtensionManager.logger.debug('Generator file is active', {
                    filePath,
                });
            } else if (Langs.getLang(filePath, true) !== undefined) {
                ExtensionManager.logger.debug('Source file is active', {
                    filePath,
                });
                if (CphNg.problem?.src.path !== filePath) {
                    ExtensionManager.logger.trace(
                        'Last source file',
                        CphNg.problem?.src.path,
                        'is not the current file',
                        { filePath },
                    );
                    await CphNg.loadProblem(filePath);
                    if (CphNg.problem === undefined) {
                        if (!CphNg.problem && Settings.cphCapable.enabled) {
                            try {
                                await access(
                                    CphCapable.getProbByCpp(filePath),
                                    constants.R_OK,
                                );
                                CphNg.canImport = true;
                            } catch {
                                CphNg.canImport = false;
                            }
                        } else {
                            CphNg.canImport = false;
                        }
                        ExtensionManager.updateContext();
                    }
                }
            } else {
                CphNg.problem = undefined;
                CphNg.canImport = false;
                ExtensionManager.updateContext();
            }
        } catch (e) {
            Io.error(
                vscode.l10n.t('Error in checkActiveFile: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
}

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

import { mkdir, readFile, rm } from 'fs/promises';
import { debounce } from 'lodash';
import { release } from 'os';
import { join } from 'path';
import { EventEmitter } from 'stream';
import {
    commands,
    env,
    ExtensionContext,
    extensions,
    l10n,
    lm,
    MessageItem,
    TextEditor,
    window,
    workspace,
} from 'vscode';
import { version } from '../../package.json';
import LlmDataInspector from '../ai/llmDataInspector';
import LlmTcRunner from '../ai/llmTcRunner';
import LlmTestCaseEditor from '../ai/llmTestCaseEditor';
import LlmTestCaseLister from '../ai/llmTestCaseLister';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import Companion from '../modules/companion';
import CphCapable from '../modules/cphCapable';
import SidebarProvider from '../modules/sidebarProvider';
import {
    extensionPath,
    fileSystemProvider,
    getActivePath,
    setActivePath,
    setExtensionUri,
    sidebarProvider,
} from '../utils/global';
import CphNg from './cphNg';
import FileSystemProvider from './fileSystemProvider';
import ProblemsManager from './problemsManager';
import Settings from './settings';

interface ContextEvent {
    hasProblem: boolean;
    canImport: boolean;
    isRunning: boolean;
}

export default class ExtensionManager {
    private static logger: Logger = new Logger('extension');
    private static compatibleTimer: NodeJS.Timeout;
    public static event: EventEmitter<{
        context: ContextEvent[];
    }> = new EventEmitter();

    public static async activate(context: ExtensionContext) {
        ExtensionManager.logger.info('Activating CPH-NG extension');
        try {
            ExtensionManager.event.on('context', (context) => {
                for (const [key, value] of Object.entries(context)) {
                    commands.executeCommand(
                        'setContext',
                        `cph-ng.${key}`,
                        value,
                    );
                }
            });

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
                mkdir(join(Settings.cache.directory, 'io'), {
                    recursive: true,
                }),
            ]);
            ExtensionManager.logger.info(
                'Cache directories created successfully',
            );

            Companion.init();

            context.subscriptions.push(
                window.registerWebviewViewProvider(
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
                workspace.registerFileSystemProvider(
                    FileSystemProvider.scheme,
                    fileSystemProvider,
                    { isCaseSensitive: true },
                ),
            );
            context.subscriptions.push(
                lm.registerTool('run_test_cases', new LlmTcRunner()),
            );
            context.subscriptions.push(
                lm.registerTool('inspect_problem_data', new LlmDataInspector()),
            );
            context.subscriptions.push(
                lm.registerTool('list_test_cases', new LlmTestCaseLister()),
            );
            context.subscriptions.push(
                lm.registerTool('upsert_test_case', new LlmTestCaseEditor()),
            );
            context.subscriptions.push(
                window.onDidChangeActiveTextEditor(
                    debounce<(editor?: TextEditor) => void>(async (editor) => {
                        setActivePath(editor);
                        sidebarProvider.event.emit('activePath', {
                            activePath: getActivePath(),
                        });
                        await ProblemsManager.dataRefresh();
                    }, 1000),
                ),
            );

            let lastAlertTime = 0;
            ExtensionManager.compatibleTimer = setInterval(async () => {
                const currentTime = Date.now();
                if (
                    extensions.getExtension(
                        'divyanshuagrawal.competitive-programming-helper',
                    )?.isActive &&
                    currentTime - lastAlertTime > 5 * 1000
                ) {
                    lastAlertTime = currentTime;
                    const result = (await Io.warn(
                        l10n.t(
                            "CPH-NG cannot run with CPH, but it can load CPH problem file. Please disable CPH to use CPH-NG. You can select the 'Ignore' option to ignore this warning in this session.",
                        ),
                        { modal: true },
                        { title: l10n.t('OK') },
                        { title: l10n.t('Ignore') },
                    )) satisfies MessageItem | undefined;
                    if (result?.title === l10n.t('Ignore')) {
                        clearInterval(ExtensionManager.compatibleTimer);
                    }
                }
            }, 1000 * 60);
            context.subscriptions.push({
                dispose: () => clearInterval(ExtensionManager.compatibleTimer),
            });

            context.subscriptions.push(
                commands.registerCommand('cph-ng.versionInfo', async () => {
                    const generated = await readFile(
                        join(extensionPath, 'dist', 'generated.json'),
                        'utf8',
                    ).then((data) => JSON.parse(data));
                    const msg = `Version: ${version}
Commit: ${generated.commitHash}
Date: ${generated.buildTime}
Build By: ${generated.buildBy}
Build Type: ${generated.buildType}
OS: ${release()}`;
                    const result = (await Io.info(
                        'CPH-NG',
                        { modal: true, detail: msg },
                        { title: l10n.t('Copy') },
                    )) satisfies MessageItem | undefined;
                    if (result?.title === l10n.t('Copy')) {
                        await env.clipboard.writeText(msg);
                    }
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.importFromCph', async () =>
                    CphCapable.importFromCph(),
                ),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.createProblem', async () => {
                    sidebarProvider.focus();
                    await CphNg.createProblem();
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.importProblem', async () => {
                    sidebarProvider.focus();
                    await CphNg.importProblem();
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.runTestCases', async () => {
                    sidebarProvider.focus();
                    await ProblemsManager.runTcs({
                        type: 'runTcs',
                        compile: null,
                        activePath: getActivePath(),
                    });
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.stopTestCases', async () => {
                    sidebarProvider.focus();
                    await ProblemsManager.stopTcs({
                        type: 'stopTcs',
                        onlyOne: false,
                        activePath: getActivePath(),
                    });
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.addTestCase', async () => {
                    await ProblemsManager.addTc({
                        type: 'addTc',
                        activePath: getActivePath(),
                    });
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.loadTestCases', async () => {
                    await ProblemsManager.loadTcs({
                        type: 'loadTcs',
                        activePath: getActivePath(),
                    });
                }),
            );
            context.subscriptions.push(
                commands.registerCommand('cph-ng.deleteProblem', async () => {
                    await ProblemsManager.delProblem({
                        type: 'delProblem',
                        activePath: getActivePath(),
                    });
                }),
            );
            context.subscriptions.push(
                commands.registerCommand(
                    'cph-ng.submitToCodeforces',
                    async () => {
                        await ProblemsManager.submitToCodeforces({
                            type: 'submitToCodeforces',
                            activePath: getActivePath(),
                        });
                    },
                ),
            );

            setActivePath(window.activeTextEditor);
            await ProblemsManager.dataRefresh();
            ExtensionManager.logger.info(
                'CPH-NG extension activated successfully',
            );
        } catch (e) {
            ExtensionManager.logger.error('Failed to activate extension', e);
            Io.error(
                l10n.t('Failed to activate CPH-NG extension: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }

    public static async deactivate() {
        ExtensionManager.logger.info('Deactivating CPH-NG extension');
        Companion.stopServer();
        await ProblemsManager.closeAll();
        ExtensionManager.logger.info('CPH-NG extension deactivated');
    }
}

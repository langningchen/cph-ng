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

import * as vscode from 'vscode';
import { CphNg } from './cphNg';
import Settings from '../utils/settings';
import * as msgs from '../webview/msgs';
import { io, Logger } from '../utils/io';
import { access, constants } from 'fs/promises';
import Companion from './companion';
import { extensionUri } from '../utils/global';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cphNgSidebar';
    private _view?: vscode.WebviewView;
    private logger: Logger = new Logger('sidebar');

    constructor(
        private helper: CphNg,
        private companion: Companion,
    ) {
        this.logger.trace('constructor');
        helper.addProblemChangeListener((problem, canImport) => {
            this.logger.debug('Problem change listener triggered', {
                problem,
                canImport,
            });
            this._view?.webview.postMessage({
                type: 'problem',
                problem,
                canImport,
            });
        });
    }

    public focus() {
        this.logger.trace('focus');
        vscode.commands.executeCommand(
            'workbench.view.extension.cphNgContainer',
        );
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this.logger.trace('resolveWebviewView', { webviewView });
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            this.logger.debug('Received message from webview', { msg });
            try {
                switch (msg.type) {
                    case 'createProblem':
                        await this.helper.createProblem();
                        break;
                    case 'importProblem':
                        await this.helper.importProblem();
                        break;
                    case 'getProblem':
                        await this.helper.getProblem();
                        break;
                    case 'editProblemDetails':
                        const editProblemDetailsMsg =
                            msg as msgs.EditProblemDetailsMsg;
                        await this.helper.editProblemDetails(
                            editProblemDetailsMsg.title,
                            editProblemDetailsMsg.url,
                            editProblemDetailsMsg.timeLimit,
                        );
                        break;
                    case 'delProblem':
                        await this.helper.delProblem();
                        break;
                    case 'addTc':
                        await this.helper.addTc();
                        break;
                    case 'loadTcs':
                        await this.helper.loadTcs();
                        break;
                    case 'updateTc':
                        const updateTcMsg = msg as msgs.UpdateTcMsg;
                        await this.helper.updateTc(
                            updateTcMsg.idx,
                            updateTcMsg.tc,
                        );
                        break;
                    case 'runTc':
                        const runTcMsg = msg as msgs.RunTcMsg;
                        await this.helper.runTc(runTcMsg.idx, runTcMsg.compile);
                        break;
                    case 'runTcs':
                        const runTcsMsg = msg as msgs.RunTcsMsg;
                        await this.helper.runTcs(runTcsMsg.compile);
                        break;
                    case 'stopTcs':
                        const stopTcsMsg = msg as msgs.StopTcsMsg;
                        await this.helper.stopTcs(stopTcsMsg.onlyOne);
                        break;
                    case 'chooseTcFile':
                        const chooseTcFileMsg = msg as msgs.ChooseTcFileMsg;
                        await this.helper.chooseTcFile(
                            chooseTcFileMsg.idx,
                            chooseTcFileMsg.label,
                        );
                        break;
                    case 'compareTc':
                        const compareTcMsg = msg as msgs.CompareTcMsg;
                        this.helper.compareTc(compareTcMsg.idx);
                        break;
                    case 'toggleTcFile':
                        const toggleTcFileMsg = msg as msgs.ToggleTcFileMsg;
                        this.helper.toggleTcFile(
                            toggleTcFileMsg.idx,
                            toggleTcFileMsg.ext,
                        );
                        break;
                    case 'delTc':
                        const delTcMsg = msg as msgs.DelTcMsg;
                        await this.helper.delTc(delTcMsg.idx);
                        break;
                    case 'openFile':
                        const openFileMsg = msg as msgs.OpenFileMsg;
                        try {
                            await access(openFileMsg.path, constants.R_OK);
                            vscode.window.showTextDocument(
                                await vscode.workspace.openTextDocument(
                                    openFileMsg.path,
                                ),
                            );
                        } catch {
                            vscode.l10n.t('File {file} does not exists.', {
                                file: openFileMsg.path,
                            });
                        }
                        break;
                    case 'chooseFile':
                        const chooseFileMsg = msg as msgs.ChooseFileMsg;
                        await this.helper.chooseFile(chooseFileMsg.file);
                        break;
                    case 'removeFile':
                        const removeFileMsg = msg as msgs.RemoveFileMsg;
                        await this.helper.removeFile(removeFileMsg.file);
                        break;
                    case 'startBfCompare':
                        const startBfCompareMsg = msg as msgs.StartBfCompareMsg;
                        await this.helper.startBfCompare(
                            startBfCompareMsg.compile,
                        );
                        break;
                    case 'stopBfCompare':
                        await this.helper.stopBfCompare();
                        break;
                    case 'submitToCodeforces':
                        await this.companion.submit(this.helper.problem);
                        break;
                    case 'startChat':
                        await vscode.commands.executeCommand(
                            'workbench.action.chat.open',
                            {
                                mode: 'agent',
                                query: '#cphNgRunTestCases ',
                                isPartialQuery: true,
                            },
                        );
                        break;
                    case 'openSettings':
                        const openSettingsMsg = msg as msgs.OpenSettingsMsg;
                        await vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            openSettingsMsg.item,
                        );
                        break;
                    default:
                        this.logger.warn('Unknown message type:', msg.type);
                }
            } catch (e) {
                io.error(
                    vscode.l10n.t(
                        'Error occurred when handling message {msgType}: {msg}.',
                        {
                            msgType: msg.type,
                            msg: e as Error,
                        },
                    ),
                );
                this.logger.error('Error handling webview message', {
                    msgType: msg.type,
                    msg: e as Error,
                });
            }
        });
    }

    public refresh() {
        this.logger.trace('refresh');
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(
                this._view.webview,
            );
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        this.logger.trace('_getHtmlForWebview', { webview });
        const getUri = (filename: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, filename));
        let isDarkMode =
            vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
                ? true
                : false;
        if (Settings.sidebar.colorTheme === 'light') {
            isDarkMode = false;
        }
        if (Settings.sidebar.colorTheme === 'dark') {
            isDarkMode = true;
        }
        return `<!DOCTYPE html><html>
<head>
<link rel="stylesheet" href="${getUri('dist/styles.css')}">
</head>

<body>
<div id="root"></div>
<script src="${getUri('dist/frontend.js')}"></script>
<script>
window.vscode = acquireVsCodeApi();
window.isDarkMode = ${isDarkMode};
window.hiddenStatuses = ${JSON.stringify(Settings.sidebar.hiddenStatuses)};
window.partyUri = '${Settings.sidebar.showAcGif ? getUri('res/party.gif') : ''}';
window.language = '${vscode.env.language}';
window.showTips = '${Settings.sidebar.showTips}';
window.fontFamily = \`${Settings.sidebar.fontFamily}\`;
</script>
</body>
</html>`;
    }
}

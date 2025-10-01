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

import { access, constants } from 'fs/promises';
import * as vscode from 'vscode';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import { extensionUri } from '../utils/global';
import * as msgs from '../webview/msgs';
import Companion from './companion';
import CphNg from './cphNg';
import Settings from './settings';

export default class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cphNgSidebar';
    private _view?: vscode.WebviewView;
    private logger: Logger = new Logger('sidebar');

    constructor() {
        this.logger.trace('constructor');
        CphNg.addProblemChangeListener((problem, canImport, startTime) => {
            this.logger.debug('Problem change listener triggered', {
                problem,
                canImport,
                startTime,
            });
            this._view?.webview.postMessage({
                type: 'problem',
                problem,
                canImport,
                startTime,
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
                        await CphNg.createProblem();
                        break;
                    case 'importProblem':
                        await CphNg.importProblem();
                        break;
                    case 'getProblem':
                        await CphNg.getProblem();
                        break;
                    case 'editProblemDetails':
                        const editProblemDetailsMsg =
                            msg as msgs.EditProblemDetailsMsg;
                        await CphNg.editProblemDetails(
                            editProblemDetailsMsg.title,
                            editProblemDetailsMsg.url,
                            editProblemDetailsMsg.timeLimit,
                            editProblemDetailsMsg.memoryLimit,
                        );
                        break;
                    case 'delProblem':
                        await CphNg.delProblem();
                        break;
                    case 'addTc':
                        await CphNg.addTc();
                        break;
                    case 'loadTcs':
                        await CphNg.loadTcs();
                        break;
                    case 'updateTc':
                        const updateTcMsg = msg as msgs.UpdateTcMsg;
                        await CphNg.updateTc(updateTcMsg.idx, updateTcMsg.tc);
                        break;
                    case 'runTc':
                        const runTcMsg = msg as msgs.RunTcMsg;
                        await CphNg.runTc(runTcMsg.idx, runTcMsg.compile);
                        break;
                    case 'runTcs':
                        const runTcsMsg = msg as msgs.RunTcsMsg;
                        await CphNg.runTcs(runTcsMsg.compile);
                        break;
                    case 'stopTcs':
                        const stopTcsMsg = msg as msgs.StopTcsMsg;
                        await CphNg.stopTcs(stopTcsMsg.onlyOne);
                        break;
                    case 'chooseTcFile':
                        const chooseTcFileMsg = msg as msgs.ChooseTcFileMsg;
                        await CphNg.chooseTcFile(
                            chooseTcFileMsg.idx,
                            chooseTcFileMsg.label,
                        );
                        break;
                    case 'compareTc':
                        const compareTcMsg = msg as msgs.CompareTcMsg;
                        CphNg.compareTc(compareTcMsg.idx);
                        break;
                    case 'toggleTcFile':
                        const toggleTcFileMsg = msg as msgs.ToggleTcFileMsg;
                        CphNg.toggleTcFile(
                            toggleTcFileMsg.idx,
                            toggleTcFileMsg.label,
                        );
                        break;
                    case 'delTc':
                        const delTcMsg = msg as msgs.DelTcMsg;
                        await CphNg.delTc(delTcMsg.idx);
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
                        await CphNg.chooseFile(chooseFileMsg.file);
                        break;
                    case 'removeFile':
                        const removeFileMsg = msg as msgs.RemoveFileMsg;
                        await CphNg.removeFile(removeFileMsg.file);
                        break;
                    case 'startBfCompare':
                        const startBfCompareMsg = msg as msgs.StartBfCompareMsg;
                        await CphNg.startBfCompare(startBfCompareMsg.compile);
                        break;
                    case 'stopBfCompare':
                        await CphNg.stopBfCompare();
                        break;
                    case 'submitToCodeforces':
                        await Companion.submit(CphNg.problem);
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
                Io.error(
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

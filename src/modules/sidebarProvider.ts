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

import EventEmitter from 'events';
import * as vscode from 'vscode';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import { extensionUri, getActivePath, sidebarProvider } from '../utils/global';
import { Problem } from '../utils/types';
import * as msgs from '../webview/msgs';
import CphNg from './cphNg';
import ProblemsManager from './problemsManager';
import Settings from './settings';

export interface ProblemEventData {
    canImport: boolean;
    problem: {
        problem: Problem;
        startTime: number;
    } | null;
    bgProblems: {
        name: string;
        srcPath: string;
    }[];
}
export interface ProblemEvent extends ProblemEventData {
    type: 'problem';
}
export interface ActivePathEventData {
    activePath?: string;
}
export interface ActivePathEvent extends ActivePathEventData {
    type: 'activePath';
}

export default class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cphNgSidebar';
    private _view?: vscode.WebviewView;
    private logger: Logger = new Logger('sidebar');
    public event: EventEmitter<{
        problem: ProblemEventData[];
        activePath: ActivePathEventData[];
    }> = new EventEmitter();

    constructor() {
        this.logger.trace('constructor');
        this.event.on('problem', (problem) => {
            this._view?.webview.postMessage({
                type: 'problem',
                ...problem,
            } satisfies ProblemEvent);
        });
        this.event.on('activePath', (problem) => {
            this._view?.webview.postMessage({
                type: 'activePath',
                ...problem,
            } satisfies ActivePathEvent);
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

        webviewView.webview.onDidReceiveMessage(
            async (msg: msgs.WebviewMsg) => {
                this.logger.debug('Received message from webview', { msg });
                try {
                    if (msg.type === 'init') {
                        sidebarProvider.event.emit('activePath', {
                            activePath: getActivePath(),
                        });
                        await ProblemsManager.dataRefresh();
                    } else if (msg.type === 'createProblem') {
                        await CphNg.createProblem(msg.activePath);
                    } else if (msg.type === 'importProblem') {
                        await CphNg.importProblem(msg.activePath);
                    } else if (msg.type === 'editProblemDetails') {
                        await ProblemsManager.editProblemDetails(msg);
                    } else if (msg.type === 'delProblem') {
                        await ProblemsManager.delProblem(msg);
                    } else if (msg.type === 'addTc') {
                        await ProblemsManager.addTc(msg);
                    } else if (msg.type === 'loadTcs') {
                        await ProblemsManager.loadTcs(msg);
                    } else if (msg.type === 'updateTc') {
                        await ProblemsManager.updateTc(msg);
                    } else if (msg.type === 'runTc') {
                        await ProblemsManager.runTc(msg);
                    } else if (msg.type === 'clearTcStatus') {
                        await ProblemsManager.clearTcStatus(msg);
                    } else if (msg.type === 'clearStatus') {
                        await ProblemsManager.clearStatus(msg);
                    } else if (msg.type === 'runTcs') {
                        await ProblemsManager.runTcs(msg);
                    } else if (msg.type === 'stopTcs') {
                        await ProblemsManager.stopTcs(msg);
                    } else if (msg.type === 'chooseTcFile') {
                        await ProblemsManager.chooseTcFile(msg);
                    } else if (msg.type === 'compareTc') {
                        await ProblemsManager.compareTc(msg);
                    } else if (msg.type === 'toggleTcFile') {
                        await ProblemsManager.toggleTcFile(msg);
                    } else if (msg.type === 'delTc') {
                        await ProblemsManager.delTc(msg);
                    } else if (msg.type === 'chooseSrcFile') {
                        await ProblemsManager.chooseSrcFile(msg);
                    } else if (msg.type === 'removeSrcFile') {
                        await ProblemsManager.removeSrcFile(msg);
                    } else if (msg.type === 'startBfCompare') {
                        await ProblemsManager.startBfCompare(msg);
                    } else if (msg.type === 'stopBfCompare') {
                        await ProblemsManager.stopBfCompare(msg);
                    } else if (msg.type === 'submitToCodeforces') {
                        await ProblemsManager.submitToCodeforces(msg);
                    } else if (msg.type === 'openFile') {
                        await ProblemsManager.openFile(msg);
                    } else if (msg.type === 'startChat') {
                        await vscode.commands.executeCommand(
                            'workbench.action.chat.open',
                            {
                                mode: 'agent',
                                query: '#cphNgRunTestCases ',
                                isPartialQuery: true,
                            },
                        );
                    } else if (msg.type === 'openSettings') {
                        const openSettingsMsg = msg as msgs.OpenSettingsMsg;
                        await vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            openSettingsMsg.item,
                        );
                    }
                } catch (e) {
                    Io.error(
                        vscode.l10n.t(
                            'Error occurred when handling message {msgType}: {msg}.',
                            {
                                msgType: msg.type,
                                msg: (e as Error).message,
                            },
                        ),
                    );
                    this.logger.error('Error handling webview message', {
                        msgType: msg.type,
                        msg: e as Error,
                    });
                }
            },
        );
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

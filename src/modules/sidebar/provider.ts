import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import { extensionUri } from '@/utils/global';
import { EventEmitter } from 'events';
import {
    commands,
    l10n,
    WebviewView,
    WebviewViewProvider,
    window,
    workspace,
} from 'vscode';
import { getHtmlForWebview } from './htmlGenerator';
import { handleMessage } from './messageHandler';
import {
    ActivePathEvent,
    ActivePathEventData,
    ProblemEvent,
    ProblemEventData,
} from './types';

export class SidebarProvider implements WebviewViewProvider {
    public static readonly viewType = 'cphNgSidebar';
    private _view?: WebviewView;
    private logger: Logger = new Logger('sidebar');
    public event: EventEmitter<{
        problem: ProblemEventData[];
        activePath: ActivePathEventData[];
    }> = new EventEmitter();

    constructor() {
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
        workspace.onDidChangeConfiguration(async (e) => {
            if (
                e.affectsConfiguration('cph-ng.sidebar.retainWhenHidden') ||
                e.affectsConfiguration('cph-ng.sidebar.showAcGif') ||
                e.affectsConfiguration('cph-ng.sidebar.colorTheme') ||
                e.affectsConfiguration('cph-ng.sidebar.hiddenStatuses') ||
                e.affectsConfiguration('cph-ng.sidebar.showTips')
            ) {
                const choice = await Io.info(
                    l10n.t(
                        'Sidebar configuration changed, please refresh to apply the new settings.',
                    ),
                    l10n.t('Refresh'),
                );
                choice && this.refresh();
            }
        });
    }

    public focus() {
        const editor = window.activeTextEditor;
        commands.executeCommand('workbench.view.extension.cphNgContainer');
        editor && window.showTextDocument(editor.document);
    }

    public resolveWebviewView(webviewView: WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [extensionUri],
        };

        webviewView.webview.html = getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(handleMessage);
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = getHtmlForWebview(this._view.webview);
        }
    }
}

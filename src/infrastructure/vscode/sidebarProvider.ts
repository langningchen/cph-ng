// Copyright (C) 2026 Langning Chen
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

import { inject, injectable } from 'tsyringe';
import { Uri, type WebviewView, type WebviewViewProvider, workspace } from 'vscode';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { WebviewHtmlRenderer } from '@/infrastructure/vscode/webviewHtmlRenderer';
import type { WebviewProtocolHandler } from '@/infrastructure/vscode/webviewProtocolHandler';

@injectable()
export class SidebarProvider implements WebviewViewProvider {
  public static readonly viewType = 'cphNgSidebar';
  private _view?: WebviewView;

  constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    private readonly htmlRenderer: WebviewHtmlRenderer,
    private readonly protocolHandler: WebviewProtocolHandler,
  ) {
    this.logger = this.logger.withScope('SidebarProvider');

    this.eventBus.onMessage((data) => {
      this._view?.webview.postMessage(data);
    });

    workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration('cph-ng.sidebar.retainWhenHidden') ||
        e.affectsConfiguration('cph-ng.sidebar.showAcGif') ||
        e.affectsConfiguration('cph-ng.sidebar.colorTheme') ||
        e.affectsConfiguration('cph-ng.sidebar.hiddenStatuses') ||
        e.affectsConfiguration('cph-ng.sidebar.showTips')
      ) {
        const choice = await this.ui.alert(
          'info',
          this.translator.t(
            'Sidebar configuration changed, please refresh to apply the new settings.',
          ),
          this.translator.t('Refresh'),
        );
        if (choice) this.refresh();
      }
    });
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.file(this.extPath)],
    };
    this.refresh();
    webviewView.webview.onDidReceiveMessage((msg) => this.protocolHandler.handle(msg));
  }

  public refresh() {
    if (this._view)
      this._view.webview.html = this.htmlRenderer.render(this._view.webview, this.extPath);
  }
}

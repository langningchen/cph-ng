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

import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ISidebarProvider } from '@v/application/ports/vscode/ISidebarProvider';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi } from '@v/application/ports/vscode/IUi';
import type { IWebviewEventBus } from '@v/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@v/composition/tokens';
import { WebviewHtmlRenderer } from '@v/infrastructure/vscode/webviewHtmlRenderer';
import { WebviewProtocolHandler } from '@v/infrastructure/vscode/webviewProtocolHandler';
import { inject, injectable } from 'tsyringe';
import { Uri, type WebviewView, workspace } from 'vscode';

@injectable()
export class SidebarProvider implements ISidebarProvider {
  public readonly viewType = 'cphNgSidebar';
  private _view?: WebviewView;

  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(WebviewHtmlRenderer) private readonly htmlRenderer: WebviewHtmlRenderer,
    @inject(WebviewProtocolHandler) private readonly protocolHandler: WebviewProtocolHandler,
  ) {
    this.logger = this.logger.withScope('sidebarProvider');

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
    if (this._view) this._view.webview.html = this.htmlRenderer.render(this._view.webview);
  }
}

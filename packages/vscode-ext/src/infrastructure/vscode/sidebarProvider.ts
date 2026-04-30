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

import EventEmitter from 'node:events';
import type { WebviewHostEvent } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';
import { Uri, type WebviewView } from 'vscode';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ISidebarProvider } from '@/application/ports/vscode/ISidebarProvider';
import { TOKENS } from '@/composition/tokens';
import { WebviewHtmlRenderer } from '@/infrastructure/vscode/webviewHtmlRenderer';
import { WebviewProtocolHandler } from '@/infrastructure/vscode/webviewProtocolHandler';

@injectable()
export class SidebarProvider implements ISidebarProvider {
  public readonly viewType = 'cphNgSidebar';
  private _view?: WebviewView;
  private isReady = false;
  private readonly pendingMessages: WebviewHostEvent[] = [];
  private readonly emitter = new EventEmitter() as TypedEventEmitter<{
    message: (payload: WebviewHostEvent) => void;
  }>;

  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(WebviewHtmlRenderer) private readonly htmlRenderer: WebviewHtmlRenderer,
    @inject(WebviewProtocolHandler) private readonly protocolHandler: WebviewProtocolHandler,
  ) {
    this.logger = this.logger.withScope('sidebarProvider');

    this.emitter.on('message', (data) => {
      this.logger.info('Emitting message to webview', data);
      if (this.isReady && this._view) this._view.webview.postMessage(data);
      else this.pendingMessages.push(data);
    });

    this.settings.companion.onChangeConfirmSubmit((confirmSubmit) =>
      this.emitter.emit('message', { type: 'configChange', payload: { confirmSubmit } }),
    );
    this.settings.sidebar.onChangeShowAcGif((showAcGif) =>
      this.emitter.emit('message', { type: 'configChange', payload: { showAcGif } }),
    );
    this.settings.sidebar.onChangeShowOobe((showOobe) =>
      this.emitter.emit('message', { type: 'configChange', payload: { showOobe } }),
    );
    this.settings.sidebar.onChangeHiddenStatuses((hiddenStatuses) =>
      this.emitter.emit('message', { type: 'configChange', payload: { hiddenStatuses } }),
    );
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this.isReady = false;
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [Uri.file(this.extPath)],
    };
    webviewView.webview.html = this.htmlRenderer.render(this._view.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.protocolHandler.handle(msg));
  }

  public sendMessage(data: WebviewHostEvent) {
    this.emitter.emit('message', data);
  }

  public dispatchFullConfig() {
    this.emitter.emit('message', {
      type: 'configChange',
      payload: {
        confirmSubmit: this.settings.companion.confirmSubmit,
        showAcGif: this.settings.sidebar.showAcGif,
        showOobe: this.settings.sidebar.showOobe,
        hiddenStatuses: this.settings.sidebar.hiddenStatuses,
      },
    });
  }

  public flushPendingMessages(): void {
    const view = this._view;
    if (!view) return;
    this.isReady = true;
    for (const message of this.pendingMessages) {
      view.webview.postMessage(message);
    }
    this.pendingMessages.length = 0;
  }
}

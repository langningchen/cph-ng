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

import type { IActiveProblemCoordinator } from '@v/application/ports/services/IActiveProblemCoordinator';
import type { IActivePathService } from '@v/application/ports/vscode/IActivePathService';
import type { IExtensionModule } from '@v/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import { TOKENS } from '@v/composition/tokens';
import { inject, injectable } from 'tsyringe';
import { type ExtensionContext, type TextEditor, window } from 'vscode';

@injectable()
export class EditorWatcherModule implements IExtensionModule {
  private _editorChangeChain: Promise<void> = Promise.resolve();

  public constructor(
    @inject(TOKENS.activePathService) private readonly activePathService: IActivePathService,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {
    this.logger = this.logger.withScope('editorWatcher');
  }

  public async setup(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        this._enqueueEditorChange(editor);
      }),
    );

    await this._enqueueEditorChange(window.activeTextEditor);
  }

  private _enqueueEditorChange(editor: TextEditor | undefined): Promise<void> {
    const p = this._editorChangeChain
      .catch(() => {})
      .then(() => this._doHandleEditorChange(editor));
    this._editorChangeChain = p.catch(() => {});
    return p;
  }

  private async _doHandleEditorChange(editor: TextEditor | undefined): Promise<void> {
    let path: string | null = null;
    if (editor && editor.document.uri.scheme === 'file') path = editor.document.uri.fsPath;
    else if (!window.tabGroups.activeTabGroup.tabs.length) path = null;
    else return this.logger.debug('Focusing on non-text editor');
    this.activePathService.setActivePath(path);
    await this.coordinator.onActiveEditorChanged();
  }
}

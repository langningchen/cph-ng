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
import { type ExtensionContext, type TextEditor, window } from 'vscode';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';

@injectable()
export class EditorWatcherModule implements IExtensionModule {
  public constructor(
    @inject(TOKENS.activePathService) private readonly activePathService: IActivePathService,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {
    this.logger = this.logger.withScope('EditorWatcher');
  }

  public async setup(context: ExtensionContext): Promise<void> {
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(async (editor) => {
        await this.handleEditorChange(editor);
      }),
    );

    if (window.activeTextEditor) await this.handleEditorChange(window.activeTextEditor);
  }

  private async handleEditorChange(editor: TextEditor | undefined) {
    let path: string | undefined;
    if (editor && editor.document.uri.scheme === 'file') path = editor.document.uri.fsPath;
    this.activePathService.setActivePath(path);
    await this.coordinator.onActiveEditorChanged(path);
  }
}

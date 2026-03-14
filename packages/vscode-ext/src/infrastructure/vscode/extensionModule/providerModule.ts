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

import type { IExtensionModule } from '@v/application/ports/vscode/IExtensionModule';
import type { IProblemFs } from '@v/application/ports/vscode/IProblemFs';
import type { ISettings } from '@v/application/ports/vscode/ISettings';
import type { ISidebarProvider } from '@v/application/ports/vscode/ISidebarProvider';
import { TOKENS } from '@v/composition/tokens';
import { inject, injectable } from 'tsyringe';
import { type ExtensionContext, window, workspace } from 'vscode';

@injectable()
export class ProviderModule implements IExtensionModule {
  public constructor(
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.sidebarProvider) private readonly sidebarProvider: ISidebarProvider,
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
  ) {}

  public setup(context: ExtensionContext) {
    context.subscriptions.push(
      window.registerWebviewViewProvider(this.sidebarProvider.viewType, this.sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: this.settings.sidebar.retainWhenHidden },
      }),
      workspace.registerFileSystemProvider(this.problemFs.scheme, this.problemFs, {
        isCaseSensitive: true,
      }),
    );
  }
}

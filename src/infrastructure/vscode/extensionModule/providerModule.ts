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
import { type ExtensionContext, window, workspace } from 'vscode';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { ProblemFs } from '../problemFs';
import { SidebarProvider } from '../sidebarProvider';

@injectable()
export class ProviderModule implements IExtensionModule {
  public constructor(
    @inject(TOKENS.settings) private readonly settings: ISettings,
    private readonly sidebarProvider: SidebarProvider,
    private readonly problemFs: ProblemFs,
  ) {}

  public setup(context: ExtensionContext) {
    context.subscriptions.push(
      window.registerWebviewViewProvider(SidebarProvider.viewType, this.sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: this.settings.sidebar.retainWhenHidden },
      }),
      workspace.registerFileSystemProvider(ProblemFs.scheme, this.problemFs, {
        isCaseSensitive: true,
      }),
    );
  }
}

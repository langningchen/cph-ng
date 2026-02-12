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
import { ColorThemeKind, env, Uri, type Webview, window } from 'vscode';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class WebviewHtmlRenderer {
  public constructor(
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
  ) {}

  public render(webview: Webview): string {
    const getUri = (filename: string) =>
      webview.asWebviewUri(Uri.joinPath(Uri.file(this.extPath), filename));

    let isDarkMode = window.activeColorTheme.kind === ColorThemeKind.Dark;
    const themePref = this.settings.sidebar.colorTheme;
    if (themePref === 'light') isDarkMode = false;
    if (themePref === 'dark') isDarkMode = true;

    const config = {
      isDarkMode,
      hiddenStatuses: this.settings.sidebar.hiddenStatuses,
      partyUri: this.settings.sidebar.showAcGif ? getUri('res/party.gif').toString() : '',
      language: env.language,
      showTips: this.settings.sidebar.showTips,
    };

    return `<!DOCTYPE html><html>
<head><link rel="stylesheet" href="${getUri('dist/styles.css')}"></head>
<body>
  <div id="root"></div>
  <script>
    window.vscode = acquireVsCodeApi();
    Object.assign(window, ${JSON.stringify(config)});
  </script>
  <script src="${getUri('dist/frontend.js')}"></script>
</body>
</html>`;
  }
}

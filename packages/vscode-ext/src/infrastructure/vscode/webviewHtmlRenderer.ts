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

import { TOKENS } from '@v/composition/tokens';
import { inject, injectable } from 'tsyringe';
import { ColorThemeKind, env, Uri, type Webview, window } from 'vscode';

@injectable()
export class WebviewHtmlRenderer {
  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.version) private readonly version: string,
  ) {}

  public render(webview: Webview): string {
    const getUri = (filename: string) =>
      webview.asWebviewUri(Uri.joinPath(Uri.file(this.extPath), filename));

    const colorTheme = window.activeColorTheme.kind;
    const config = {
      version: this.version,
      isDark: colorTheme === ColorThemeKind.Dark || colorTheme === ColorThemeKind.HighContrast,
      partyUri: getUri('res/party.gif').toString(),
      language: env.language,
    };

    return `<!DOCTYPE html><html>
<head><link rel="stylesheet" href="${getUri('dist/styles.css')}"></head>
<body>
  <div id="root"></div>
  <script type="application/json" id="cph-ng-config">
    ${JSON.stringify(config)}
  </script>
  <script>
    window.vscode = acquireVsCodeApi();
    const configEl = document.getElementById('cph-ng-config');
    if (!configEl) console.error('Config element not found');
    try {
      const config = JSON.parse(configEl.textContent || '{}');
      Object.assign(window, config);
    } catch (e) {
      console.error('Failed to parse config', e);
    }
  </script>
  <script src="${getUri('dist/frontend.js')}"></script>
</body>
</html>`;
  }
}

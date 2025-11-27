import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { extensionUri } from '@/utils/global';
import { ColorThemeKind, env, Uri, Webview, window } from 'vscode';

const logger = new Logger('sidebar-html');

export const getHtmlForWebview = (webview: Webview): string => {
    logger.debug('Generating HTML for webview');
    const getUri = (filename: string) =>
        webview.asWebviewUri(Uri.joinPath(extensionUri, filename));
    let isDarkMode =
        window.activeColorTheme.kind === ColorThemeKind.Dark ? true : false;
    if (Settings.sidebar.colorTheme === 'light') {
        isDarkMode = false;
    }
    if (Settings.sidebar.colorTheme === 'dark') {
        isDarkMode = true;
    }
    return `<!DOCTYPE html><html>
<head>
<link rel="stylesheet" href="${getUri('dist/styles.css')}">
</head>

<body>
<div id="root"></div>
<script src="${getUri('dist/frontend.js')}"></script>
<script>
window.vscode = acquireVsCodeApi();
window.isDarkMode = ${isDarkMode};
window.hiddenStatuses = ${JSON.stringify(Settings.sidebar.hiddenStatuses)};
window.partyUri = '${Settings.sidebar.showAcGif ? getUri('res/party.gif') : ''}';
window.language = '${env.language}';
window.showTips = ${Settings.sidebar.showTips};
</script>
</body>
</html>`;
};

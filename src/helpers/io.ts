// Copyright (C) 2025 Langning Chen
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

import Logger from '@/helpers/logger';
import { l10n, window } from 'vscode';

const compilationChannel = window.createOutputChannel(
    l10n.t('CPH-NG Compilation'),
);

export default class Io {
    private static logger: Logger = new Logger('io');

    public static info(msg: string, ...args: any) {
        this.logger.info(msg);
        return window.showInformationMessage(msg, ...args);
    }
    public static warn(msg: string, ...args: any) {
        this.logger.warn(msg);
        return window.showWarningMessage(msg, ...args);
    }
    public static error(msg: string, ...args: any) {
        this.logger.error(msg);
        return window.showErrorMessage(msg, ...args);
    }
    public static async confirm(msg: string): Promise<boolean> {
        this.logger.info(msg);
        const yesOption = l10n.t('Yes');
        return (
            (await window.showInformationMessage(
                msg,
                { modal: true },
                yesOption,
            )) === yesOption
        );
    }
}

export class CompilationIo {
    private static _compilationMsg: string = '';
    public static clear() {
        compilationChannel.clear();
        this._compilationMsg = '';
        compilationChannel.hide();
    }
    public static append(msg: string) {
        msg = msg.trimEnd();
        if (!msg) {
            return;
        }
        msg += '\n';
        this._compilationMsg += msg + '\n';
        compilationChannel.appendLine(msg);
        compilationChannel.show();
    }
    public static toString(): string {
        return this._compilationMsg;
    }
}

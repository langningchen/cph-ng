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

import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('CPH-NG', {
    log: true,
});
const compilationChannel = vscode.window.createOutputChannel(
    vscode.l10n.t('CPH-NG Compilation'),
);

export class Logger {
    private module: string;
    constructor(module: string) {
        this.module = module;
    }
    private message(...args: any[]) {
        const messageData = args
            .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
            .join(' ');
        return `[${this.module}] ${messageData}`;
    }
    public trace(...args: any[]) {
        outputChannel.trace(this.message(...args));
    }
    public debug(...args: any[]) {
        outputChannel.debug(this.message(...args));
    }
    public info(...args: any[]) {
        outputChannel.info(this.message(...args));
    }
    public warn(...args: any[]) {
        outputChannel.warn(this.message(...args));
    }
    public error(...args: any[]) {
        outputChannel.error(this.message(...args));
    }
}

export class Io {
    private logger: Logger = new Logger('io');
    private _compilationMsg = '';

    public info(msg: string, ...args: any) {
        this.logger.info(msg);
        return vscode.window.showInformationMessage(msg, ...args);
    }
    public warn(msg: string, ...args: any) {
        this.logger.warn(msg);
        return vscode.window.showWarningMessage(msg, ...args);
    }
    public error(msg: string, ...args: any) {
        this.logger.error(msg);
        return vscode.window.showErrorMessage(msg, ...args);
    }
    public async confirm(
        msg: string,
        modal: boolean = false,
    ): Promise<boolean> {
        this.logger.info(msg);
        return (
            (await vscode.window.showInformationMessage(
                msg,
                { modal },
                'Yes',
                'No',
            )) === 'Yes'
        );
    }

    set compilationMsg(msg: string) {
        this.logger.info('Setting compilation message', msg);
        compilationChannel.clear();
        compilationChannel.appendLine(msg);
        if (msg.trim()) {
            compilationChannel.show();
        } else {
            compilationChannel.hide();
        }
        this._compilationMsg = msg;
    }

    get compilationMsg(): string {
        return this._compilationMsg;
    }
}

export const io = new Io();

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

import { window } from 'vscode';

const outputChannel = window.createOutputChannel('CPH-NG', {
  log: true,
});

export default class Logger {
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

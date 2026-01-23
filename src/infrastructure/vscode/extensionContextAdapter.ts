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

import { injectable } from 'tsyringe';
import { commands } from 'vscode';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';

@injectable()
export class ExtensionContextAdapter implements IExtensionContext {
  private _hasProblem: boolean = false;
  private _canImport: boolean = false;
  private _isRunning: boolean = false;

  private setContext(key: string, value: boolean) {
    commands.executeCommand('setContext', `cph-ng.${key}`, value);
  }

  public get hasProblem() {
    return this._hasProblem;
  }
  public set hasProblem(value: boolean) {
    this.setContext('hasProblem', value);
    this._hasProblem = value;
  }
  public get canImport() {
    return this._canImport;
  }
  public set canImport(value: boolean) {
    this.setContext('canImport', value);
    this._canImport = value;
  }
  public get isRunning() {
    return this._isRunning;
  }
  public set isRunning(value: boolean) {
    this.setContext('isRunning', value);
    this._isRunning = value;
  }
}

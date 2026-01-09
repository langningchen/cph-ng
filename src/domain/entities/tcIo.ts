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

import type { ITcIo } from '@/types';

export class TcIo {
  constructor(
    private _useFile: boolean = false,
    private _data: string = '',
  ) {}
  public static fromI(tc: ITcIo): TcIo {
    const instance = new TcIo();
    instance.fromI(tc);
    return instance;
  }
  public fromI(tc: ITcIo) {
    this._useFile = tc.useFile;
    this._data = tc.data;
  }

  get useFile(): boolean {
    return this._useFile;
  }
  get data(): string {
    return this._data;
  }

  public getDisposables(): string[] {
    if (!this._useFile) return [];
    return [this._data];
  }
  public isRelated(path: string): boolean {
    return this._useFile && this._data.toLowerCase() === path;
  }

  public toJSON(): ITcIo {
    return {
      useFile: this._useFile,
      data: this._data,
    };
  }
}

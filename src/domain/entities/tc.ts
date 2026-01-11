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

import { TcIo } from '@/domain/entities/tcIo';
import type { VerdictName } from '@/domain/entities/verdict';

export interface UpdatedResult {
  isExpand?: boolean;
  timeMs?: number;
  memoryMb?: number;
  msg?: string;
}

interface ITcResult {
  readonly verdict: VerdictName;
  readonly time?: number;
  readonly memory?: number;
  readonly stdout?: TcIo;
  readonly stderr?: TcIo;
  readonly msg?: string;
}

export class Tc {
  constructor(
    public stdin: TcIo = new TcIo({ data: '' }),
    public answer: TcIo = new TcIo({ data: '' }),
    private _isExpand: boolean = false,
    private _isDisabled: boolean = false,
    private _result?: ITcResult,
  ) {}

  get isExpand(): boolean {
    return this._isExpand;
  }
  get isDisabled(): boolean {
    return this._isDisabled;
  }
  get verdict(): VerdictName | undefined {
    return this._result?.verdict;
  }
  get time(): number | undefined {
    return this._result?.time;
  }
  get memory(): number | undefined {
    return this._result?.memory;
  }
  get stdout(): TcIo | undefined {
    return this._result?.stdout;
  }
  get stderr(): TcIo | undefined {
    return this._result?.stderr;
  }
  get msg(): string | undefined {
    return this._result?.msg;
  }

  public toggleExpand() {
    this._isExpand = !this._isExpand;
  }
  public toggleDisable() {
    this._isDisabled = !this._isDisabled;
  }

  public clearResult(): string[] {
    const disposables: string[] = [
      ...(this._result?.stdout?.getDisposables() || []),
      ...(this._result?.stderr?.getDisposables() || []),
    ];
    delete this._result;
    return disposables;
  }
  public updateResult(
    verdict: VerdictName,
    { isExpand, timeMs, memoryMb, msg }: UpdatedResult = {},
  ): void {
    const current = this._result || { verdict };
    this._result = {
      ...current,
      verdict,
      time: timeMs ?? current.time,
      memory: memoryMb ?? current.memory,
      msg: this.formatMessage(current.msg, msg),
    };
    if (isExpand !== undefined) this._isExpand = isExpand;
  }
  public getDisposables(): string[] {
    return [
      ...this.stdin.getDisposables(),
      ...this.answer.getDisposables(),
      ...(this._result?.stdout?.getDisposables() || []),
      ...(this._result?.stderr?.getDisposables() || []),
    ];
  }
  public isRelated(path: string): boolean {
    path = path.toLowerCase();
    return (
      this.stdin.path === path ||
      this.answer.path === path ||
      this._result?.stdout?.path === path ||
      this._result?.stderr?.path === path
    );
  }
  private formatMessage(oldMsg?: string, newMsg?: string): string | undefined {
    if (!newMsg) return oldMsg;
    const trimmed = newMsg.trim();
    if (!oldMsg) return `${trimmed}\n`;
    return `${oldMsg}\n${trimmed}\n`;
  }
}

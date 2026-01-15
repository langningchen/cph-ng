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

import EventEmitter from 'node:events';
import type TypedEventEmitter from 'typed-emitter';
import { TcIo } from '@/domain/entities/tcIo';
import type { VerdictName } from '@/domain/entities/verdict';

export interface UpdatedResult {
  isExpand?: boolean;
  timeMs?: number;
  memoryMb?: number;
  msg?: string;
}

export interface TcResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  stdout?: TcIo;
  stderr?: TcIo;
  msg?: string;
}

export type TcEvents = {
  patchTc: (payload: Partial<Tc>) => void;
  patchTcResult: (payload: Partial<TcResult>) => void;
};

export class Tc {
  public readonly signals: TypedEventEmitter<TcEvents> = new EventEmitter();

  public constructor(
    private _stdin: TcIo = new TcIo({ data: '' }),
    private _answer: TcIo = new TcIo({ data: '' }),
    private _isExpand: boolean = false,
    private _isDisabled: boolean = false,
    private _result?: TcResult,
  ) {}

  public get stdin(): TcIo {
    return this._stdin;
  }
  public set stdin(value: TcIo) {
    this._stdin = value;
    this.signals.emit('patchTc', { stdin: value });
  }
  public get answer(): TcIo {
    return this._answer;
  }
  public set answer(value: TcIo) {
    this._answer = value;
    this.signals.emit('patchTc', { answer: value });
  }
  public get isExpand(): boolean {
    return this._isExpand;
  }
  public get isDisabled(): boolean {
    return this._isDisabled;
  }
  public get verdict(): VerdictName | undefined {
    return this._result?.verdict;
  }
  public get timeMs(): number | undefined {
    return this._result?.timeMs;
  }
  public get memoryMb(): number | undefined {
    return this._result?.memoryMb;
  }
  public get stdout(): TcIo | undefined {
    return this._result?.stdout;
  }
  public get stderr(): TcIo | undefined {
    return this._result?.stderr;
  }
  public get msg(): string | undefined {
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
      verdict,
      timeMs: timeMs ?? current.timeMs,
      memoryMb: memoryMb ?? current.memoryMb,
      msg: this.formatMessage(current.msg, msg),
    };
    this.signals.emit('patchTcResult', { verdict, timeMs, memoryMb, msg });
    if (isExpand !== undefined) {
      this._isExpand = isExpand;
      this.signals.emit('patchTc', { isExpand });
    }
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

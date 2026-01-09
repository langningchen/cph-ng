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
import type { ITc } from '@/types';

export interface UpdatedResult {
  isExpand?: boolean;
  timeMs?: number;
  memoryMb?: number;
  msg?: string;
}

export class Tc {
  constructor(
    public stdin: TcIo = new TcIo(),
    public answer: TcIo = new TcIo(),
    private _isExpand: boolean = false,
    private _isDisabled: boolean = false,
    private _result?: {
      verdict: VerdictName;
      time?: number;
      memory?: number;
      stdout?: TcIo;
      stderr?: TcIo;
      msg?: string;
    },
  ) {}
  public static fromI(tc: ITc): Tc {
    const instance = new Tc();
    instance.fromI(tc);
    return instance;
  }
  public fromI(tc: ITc): void {
    this.stdin.fromI(tc.stdin);
    this.answer.fromI(tc.answer);
    this._isExpand = tc.isExpand;
    this._isDisabled = tc.isDisabled;
    if (tc.result)
      this._result = {
        verdict: tc.result.verdict,
        time: tc.result.time,
        memory: tc.result.memory,
        stdout: tc.result.stdout && TcIo.fromI(tc.result.stdout),
        stderr: tc.result.stderr && TcIo.fromI(tc.result.stderr),
        msg: tc.result.msg,
      };
  }

  get isExpand(): boolean {
    return this._isExpand;
  }
  get isDisabled(): boolean {
    return this._isDisabled;
  }
  get verdict(): VerdictName | undefined {
    return this._result?.verdict;
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
    if (!this._result) this._result = { verdict };
    else this._result.verdict = verdict;
    if (isExpand !== undefined) this._isExpand = isExpand;
    if (timeMs !== undefined) this._result.time = timeMs;
    if (memoryMb !== undefined) this._result.memory = memoryMb;
    if (msg !== undefined) {
      msg = `${msg.trim()}\n`;
      if (!this._result.msg) this._result.msg = msg;
      else this._result.msg += `\n${msg}`;
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
    return (
      this.stdin.isRelated(path) ||
      this.answer.isRelated(path) ||
      (this._result?.stdout?.isRelated(path) ?? false) ||
      (this._result?.stderr?.isRelated(path) ?? false)
    );
  }

  public toJSON(): ITc {
    return {
      stdin: this.stdin.toJSON(),
      answer: this.answer.toJSON(),
      isExpand: this._isExpand,
      isDisabled: this._isDisabled,
      result: this._result && {
        verdict: this._result.verdict,
        time: this._result.time,
        memory: this._result.memory,
        stdout: this._result.stdout?.toJSON(),
        stderr: this._result.stderr?.toJSON(),
        msg: this._result.msg,
      },
    };
  }
}

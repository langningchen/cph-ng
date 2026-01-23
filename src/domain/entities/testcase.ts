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
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { VerdictName } from '@/domain/entities/verdict';

export interface TestcaseResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  stdout?: TestcaseIo;
  stderr?: TestcaseIo;
  msg?: string;
}

export type UpdatedResult = TestcaseResult & {
  isExpand?: boolean;
};

export type TestcaseEvents = {
  patchTestcase: (payload: Partial<Testcase>) => void;
  patchTestcaseResult: (payload: Partial<TestcaseResult>) => void;
};

export class Testcase {
  public readonly signals: TypedEventEmitter<TestcaseEvents> = new EventEmitter();

  public constructor(
    private _stdin: TestcaseIo = new TestcaseIo({ data: '' }),
    private _answer: TestcaseIo = new TestcaseIo({ data: '' }),
    private _isExpand: boolean = false,
    private _isDisabled: boolean = false,
    private _result?: TestcaseResult,
  ) {}

  public get stdin(): TestcaseIo {
    return this._stdin;
  }
  public set stdin(value: TestcaseIo) {
    this._stdin = value;
    this.signals.emit('patchTestcase', { stdin: value });
  }
  public get answer(): TestcaseIo {
    return this._answer;
  }
  public set answer(value: TestcaseIo) {
    this._answer = value;
    this.signals.emit('patchTestcase', { answer: value });
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
  public get stdout(): TestcaseIo | undefined {
    return this._result?.stdout;
  }
  public get stderr(): TestcaseIo | undefined {
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
  public updateResult(updated: UpdatedResult): void {
    const { verdict, timeMs, memoryMb, stdout, stderr, msg, isExpand } = updated;
    const current = this._result || { verdict };
    this._result = {
      verdict,
      timeMs: timeMs ?? current.timeMs,
      memoryMb: memoryMb ?? current.memoryMb,
      stdout: stdout ?? current.stdout,
      stderr: stderr ?? current.stderr,
      msg: this.formatMessage(current.msg, msg),
    };
    this.signals.emit('patchTestcaseResult', { verdict, timeMs, memoryMb, msg });
    if (isExpand !== undefined) {
      this._isExpand = isExpand;
      this.signals.emit('patchTestcase', { isExpand });
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
      this.stdin.path?.toLowerCase() === path ||
      this.answer.path?.toLowerCase() === path ||
      this._result?.stdout?.path?.toLowerCase() === path ||
      this._result?.stderr?.path?.toLowerCase() === path
    );
  }
  private formatMessage(oldMsg?: string, newMsg?: string): string | undefined {
    if (!newMsg) return oldMsg;
    const trimmed = newMsg.trim();
    if (!oldMsg) return `${trimmed}\n`;
    return `${oldMsg}\n${trimmed}\n`;
  }
}

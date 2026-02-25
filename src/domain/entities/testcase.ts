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
import { VerdictName } from '@/domain/entities/verdict';

export interface TestcaseResult {
  verdict: VerdictName;
  timeMs: number | null;
  memoryMb: number | null;
  stdout: TestcaseIo | null;
  stderr: TestcaseIo | null;
  msg: string | null;
}

export type TestcaseEvents = {
  patchTestcase: (payload: Partial<Testcase>) => void;
  patchTestcaseResult: (payload: Partial<TestcaseResult>) => void;
};

const pick = <T>(next: T | null | undefined, fallback: T | null): T | null =>
  next === undefined ? fallback : next;

export class Testcase {
  public readonly signals = new EventEmitter() as TypedEventEmitter<TestcaseEvents>;

  public constructor(
    private _stdin: TestcaseIo = new TestcaseIo({ data: '' }),
    private _answer: TestcaseIo = new TestcaseIo({ data: '' }),
    private _isExpand: boolean = false,
    private _isDisabled: boolean = false,
    private _result: TestcaseResult | null = null,
  ) {}

  public get stdin(): TestcaseIo {
    return this._stdin;
  }
  public set stdin(value: Readonly<TestcaseIo>) {
    this._stdin = value;
    this.signals.emit('patchTestcase', { stdin: value });
  }
  public get answer(): TestcaseIo {
    return this._answer;
  }
  public set answer(value: Readonly<TestcaseIo>) {
    this._answer = value;
    this.signals.emit('patchTestcase', { answer: value });
  }
  public get isExpand(): boolean {
    return this._isExpand;
  }
  public set isExpand(value: boolean) {
    this._isExpand = value;
    this.signals.emit('patchTestcase', { isExpand: this._isExpand });
  }
  public get isDisabled(): boolean {
    return this._isDisabled;
  }
  public set isDisabled(value: boolean) {
    this._isDisabled = value;
    this.signals.emit('patchTestcase', { isDisabled: this._isDisabled });
  }
  public get result(): Readonly<TestcaseResult> | null {
    return this._result;
  }

  public clearResult(): string[] {
    const disposables: string[] = [
      ...(this._result?.stdout?.getDisposables() ?? []),
      ...(this._result?.stderr?.getDisposables() ?? []),
    ];
    this._result = null;
    this.signals.emit('patchTestcase', { result: null });
    return disposables;
  }
  public updateResult(updated: Readonly<Partial<TestcaseResult>>): void {
    const base: TestcaseResult = this._result ?? {
      verdict: VerdictName.unknownError,
      timeMs: null,
      memoryMb: null,
      stdout: null,
      stderr: null,
      msg: null,
    };
    this._result = {
      verdict: updated.verdict ?? base.verdict,
      timeMs: pick(updated.timeMs, base.timeMs),
      memoryMb: pick(updated.memoryMb, base.memoryMb),
      stdout: pick(updated.stdout, base.stdout),
      stderr: pick(updated.stderr, base.stderr),
      msg: this.formatMessage(base.msg, updated.msg),
    };
    this.signals.emit('patchTestcaseResult', updated);
  }
  public getDisposables(): string[] {
    return [
      ...this.stdin.getDisposables(),
      ...this.answer.getDisposables(),
      ...(this._result?.stdout?.getDisposables() ?? []),
      ...(this._result?.stderr?.getDisposables() ?? []),
    ];
  }
  public isRelated(path: string): boolean {
    const paths = [
      this.stdin.path,
      this.answer.path,
      this._result?.stdout?.path,
      this._result?.stderr?.path,
    ];
    return paths.includes(path);
  }
  private formatMessage(oldMsg: string | null, newMsg?: string | null): string | null {
    if (!newMsg) return oldMsg;
    const trimmed = newMsg.trim();
    if (!oldMsg) return `${trimmed}\n`;
    return `${oldMsg}\n${trimmed}\n`;
  }
}

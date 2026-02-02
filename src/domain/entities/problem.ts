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

import type { UUID } from 'node:crypto';
import EventEmitter from 'node:events';
import type TypedEventEmitter from 'typed-emitter';
import { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import type { IFileWithHash, IOverrides } from '@/domain/types';

export interface ProblemMetaPayload {
  checker?: IFileWithHash | null;
  interactor?: IFileWithHash | null;
}
export type ProblemEvents = {
  patchMeta: (payload: ProblemMetaPayload) => void;
  patchStressTest: (payload: Partial<StressTest>) => void;
  addTestcase: (testcaseId: UUID, payload: Testcase) => void;
  deleteTestcase: (testcaseId: UUID) => void;
  patchTestcase: (testcaseId: UUID, payload: Partial<Testcase>) => void;
  patchTestcaseResult: (testcaseId: UUID, payload: Partial<TestcaseResult>) => void;
};

export class Problem {
  public readonly src: IFileWithHash;
  public url?: string;
  private _testcases: Map<UUID, Testcase> = new Map();
  private _testcaseOrder: UUID[] = [];
  private _checker: IFileWithHash | null = null;
  private _interactor: IFileWithHash | null = null;
  private _stressTest: StressTest = new StressTest();
  private _timeElapsedMs: number = 0;
  public overrides: IOverrides = {};
  public readonly signals: TypedEventEmitter<ProblemEvents> = new EventEmitter();

  public constructor(
    public name: string,
    src: string | IFileWithHash,
  ) {
    if (typeof src === 'string') this.src = { path: src };
    else this.src = src;
    this._stressTest.signals.on('change', this.stressTestChanged);
  }

  private stressTestChanged = (payload: Partial<StressTest>) => {
    this.signals.emit('patchStressTest', payload);
  };

  public get testcases(): Map<UUID, Testcase> {
    return this._testcases;
  }
  public get testcaseOrder(): readonly UUID[] {
    return this._testcaseOrder;
  }
  public get checker() {
    return this._checker;
  }
  public set checker(file: IFileWithHash | null) {
    this._checker = file;
    this.signals.emit('patchMeta', { checker: file });
  }
  public get interactor() {
    return this._interactor;
  }
  public set interactor(file: IFileWithHash | null) {
    this._interactor = file;
    this.signals.emit('patchMeta', { interactor: file });
  }
  public get stressTest(): StressTest {
    return this._stressTest;
  }
  public set stressTest(stressTest: StressTest) {
    this._stressTest.signals.off('change', this.stressTestChanged);
    this._stressTest = stressTest;
    this._stressTest.signals.on('change', this.stressTestChanged);
  }
  public get timeElapsedMs() {
    return this._timeElapsedMs;
  }

  private onPatchTestcase(testcaseId: UUID, payload: Partial<Testcase>) {
    this.signals.emit('patchTestcase', testcaseId, payload);
  }
  private onPatchTestcaseResult(testcaseId: UUID, payload: Partial<TestcaseResult>) {
    this.signals.emit('patchTestcaseResult', testcaseId, payload);
  }

  public addTestcase(testcaseId: UUID, testcase: Testcase) {
    this._testcases.set(testcaseId, testcase);
    this._testcaseOrder.push(testcaseId);
    this.signals.emit('addTestcase', testcaseId, testcase);
    testcase.signals.on('patchTestcase', (payload) => this.onPatchTestcase(testcaseId, payload));
    testcase.signals.on('patchTestcaseResult', (payload) =>
      this.onPatchTestcaseResult(testcaseId, payload),
    );
  }
  public getTestcase(testcaseId: UUID): Testcase {
    const testcase = this._testcases.get(testcaseId);
    if (!testcase) throw new Error('Test case not found');
    return testcase;
  }
  public deleteTestcase(testcaseId: UUID): void {
    this._testcaseOrder = this._testcaseOrder.filter((id) => id !== testcaseId);
  }
  public clearTestcases(): string[] {
    const disposables = this.purgeUnusedTestcases();
    this._testcaseOrder = [];
    for (const [testcaseId, testcase] of this._testcases) {
      disposables.push(...testcase.getDisposables());
      this.signals.emit('deleteTestcase', testcaseId);
    }
    this._testcases.clear();
    return disposables;
  }
  public moveTestcase(fromIdx: number, toIdx: number): void {
    const [movedTestcase] = this._testcaseOrder.splice(fromIdx, 1);
    this._testcaseOrder.splice(toIdx, 0, movedTestcase);
  }
  public getEnabledTestcaseIds(): UUID[] {
    const enabledIds: UUID[] = [];
    for (const testcaseId of this._testcaseOrder) {
      const testcase = this._testcases.get(testcaseId);
      if (testcase && !testcase.isDisabled) enabledIds.push(testcaseId);
    }
    return enabledIds;
  }
  public purgeUnusedTestcases(): string[] {
    const activeIds = new Set(this._testcaseOrder);
    const disposables: string[] = [];
    for (const [testcaseId, testcase] of this._testcases)
      if (!activeIds.has(testcaseId)) {
        disposables.push(...testcase.getDisposables());
        testcase.signals.removeAllListeners();
        this._testcases.delete(testcaseId);
      }
    return disposables;
  }
  public clearResult(): string[] {
    const disposables: string[] = [];
    for (const testcaseId of this._testcaseOrder)
      disposables.push(...this.getTestcase(testcaseId).clearResult());
    return disposables;
  }
  public isRelated(path: string): boolean {
    path = path.toLowerCase();
    if (
      this.src.path?.toLowerCase() === path ||
      this._checker?.path?.toLowerCase() === path ||
      this._interactor?.path?.toLowerCase() === path ||
      this._stressTest?.bruteForce?.path?.toLowerCase() === path ||
      this._stressTest?.generator?.path?.toLowerCase() === path
    )
      return true;
    for (const [_, testcase] of this._testcases) if (testcase.isRelated(path)) return true;
    return false;
  }
  public addTimeElapsed(addMs: number) {
    this._timeElapsedMs += addMs;
  }
  public updateResult(...params: Parameters<Testcase['updateResult']>) {
    for (const testcaseId of this._testcaseOrder)
      this._testcases.get(testcaseId)?.updateResult(...params);
  }
}

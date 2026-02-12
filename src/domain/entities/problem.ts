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
import { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import type { IFileWithHash, IOverrides, TestcaseId, WithRevision } from '@/domain/types';

export interface ProblemMetaPayload {
  checker?: IFileWithHash | null;
  interactor?: IFileWithHash | null;
}
export type ProblemEvents = {
  patchMeta: (payload: WithRevision<ProblemMetaPayload>) => void;
  patchStressTest: (payload: WithRevision<Partial<StressTest>>) => void;
  addTestcase: (testcaseId: TestcaseId, payload: Testcase, revision: number) => void;
  deleteTestcase: (testcaseId: TestcaseId, revision: number) => void;
  patchTestcase: (testcaseId: TestcaseId, payload: Partial<Testcase>, revision: number) => void;
  patchTestcaseResult: (
    testcaseId: TestcaseId,
    payload: Partial<TestcaseResult>,
    revision: number,
  ) => void;
};

export class Problem {
  public readonly src: IFileWithHash;
  public url?: string;
  private _revision: number = 0;
  private _testcases: Map<TestcaseId, Testcase> = new Map();
  private _testcaseOrder: TestcaseId[] = [];
  private _checker: IFileWithHash | null = null;
  private _interactor: IFileWithHash | null = null;
  private _stressTest: StressTest = new StressTest();
  private _timeElapsedMs: number = 0;
  public overrides: IOverrides = {};
  public readonly signals = new EventEmitter() as TypedEventEmitter<ProblemEvents>;

  public constructor(
    public name: string,
    src: string | IFileWithHash,
  ) {
    if (typeof src === 'string') this.src = { path: src };
    else this.src = src;
    this._stressTest.signals.on('change', this.stressTestChanged);
  }

  public get revision(): number {
    return this._revision;
  }

  private bumpRevision() {
    this._revision++;
  }

  private stressTestChanged = (payload: Partial<StressTest>) => {
    this.bumpRevision();
    this.signals.emit('patchStressTest', { ...payload, revision: this._revision });
  };

  public get testcases(): Map<TestcaseId, Testcase> {
    return this._testcases;
  }
  public get testcaseOrder(): readonly TestcaseId[] {
    return this._testcaseOrder;
  }
  public get checker() {
    return this._checker;
  }
  public set checker(file: IFileWithHash | null) {
    this._checker = file;
    this.bumpRevision();
    this.signals.emit('patchMeta', { checker: file, revision: this._revision });
  }
  public get interactor() {
    return this._interactor;
  }
  public set interactor(file: IFileWithHash | null) {
    this._interactor = file;
    this.bumpRevision();
    this.signals.emit('patchMeta', { interactor: file, revision: this._revision });
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

  private onPatchTestcase(testcaseId: TestcaseId, payload: Partial<Testcase>) {
    this.bumpRevision();
    this.signals.emit('patchTestcase', testcaseId, payload, this._revision);
  }
  private onPatchTestcaseResult(testcaseId: TestcaseId, payload: Partial<TestcaseResult>) {
    this.bumpRevision();
    this.signals.emit('patchTestcaseResult', testcaseId, payload, this._revision);
  }

  public addTestcase(testcaseId: TestcaseId, testcase: Testcase) {
    this._testcases.set(testcaseId, testcase);
    this._testcaseOrder.push(testcaseId);
    this.bumpRevision();
    this.signals.emit('addTestcase', testcaseId, testcase, this._revision);
    testcase.signals.on('patchTestcase', (payload) => this.onPatchTestcase(testcaseId, payload));
    testcase.signals.on('patchTestcaseResult', (payload) =>
      this.onPatchTestcaseResult(testcaseId, payload),
    );
  }
  public getTestcase(testcaseId: TestcaseId): Testcase {
    const testcase = this._testcases.get(testcaseId);
    if (!testcase) throw new Error('Test case not found');
    return testcase;
  }
  public deleteTestcase(testcaseId: TestcaseId): void {
    this._testcaseOrder = this._testcaseOrder.filter((id) => id !== testcaseId);
    this.bumpRevision();
    this.signals.emit('deleteTestcase', testcaseId, this._revision);
  }
  public clearTestcases(): string[] {
    const disposables = this.purgeUnusedTestcases();
    this._testcaseOrder = [];
    for (const [testcaseId, testcase] of this._testcases) {
      disposables.push(...testcase.getDisposables());
      this.bumpRevision();
      this.signals.emit('deleteTestcase', testcaseId, this._revision);
    }
    this._testcases.clear();
    return disposables;
  }
  public moveTestcase(fromIdx: number, toIdx: number): void {
    const [movedTestcase] = this._testcaseOrder.splice(fromIdx, 1);
    this._testcaseOrder.splice(toIdx, 0, movedTestcase);
    this.bumpRevision();
  }
  public getEnabledTestcaseIds(): TestcaseId[] {
    const enabledIds: TestcaseId[] = [];
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
    for (const testcaseId of this._testcaseOrder) {
      const testcase = this._testcases.get(testcaseId);
      if (testcase && !testcase.isDisabled) testcase.updateResult(...params);
    }
  }
}

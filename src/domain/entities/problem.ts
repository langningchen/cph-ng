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
import { BfCompare } from '@/domain/entities/bfCompare';
import type { Tc, TcResult } from '@/domain/entities/tc';
import type { IFileWithHash, IOverrides } from '@/domain/types';

export interface ProblemMetaPayload {
  checker?: IFileWithHash;
  interactor?: IFileWithHash;
}
// TO-DO addTc deleteTc events
export type ProblemEvents = {
  patchMeta: (payload: ProblemMetaPayload) => void;
  patchBfCompare: (payload: Partial<BfCompare>) => void;
  addTc: (id: UUID, payload: Tc) => void;
  deleteTc: (id: UUID) => void;
  patchTc: (id: UUID, payload: Partial<Tc>) => void;
  patchTcResult: (id: UUID, payload: Partial<TcResult>) => void;
};

export class Problem {
  public readonly src: IFileWithHash;
  public url?: string;
  private _tcs: Map<UUID, Tc> = new Map();
  private _tcOrder: UUID[] = [];
  private _checker?: IFileWithHash;
  private _interactor?: IFileWithHash;
  private _bfCompare: BfCompare = new BfCompare();
  private _timeElapsedMs: number = 0;
  public overrides: IOverrides = {};
  public readonly signals: TypedEventEmitter<ProblemEvents> = new EventEmitter();

  public constructor(
    public name: string,
    src: string | IFileWithHash,
  ) {
    if (typeof src === 'string') this.src = { path: src };
    else this.src = src;
    this._bfCompare.signals.on('change', this.bfCompareChanged);
  }

  private bfCompareChanged = (payload: Partial<BfCompare>) => {
    this.signals.emit('patchBfCompare', payload);
  };

  public get tcs(): Readonly<Map<UUID, Tc>> {
    return this._tcs;
  }
  public get tcOrder(): readonly UUID[] {
    return this._tcOrder;
  }
  public get checker() {
    return this._checker;
  }
  public set checker(file: IFileWithHash | undefined) {
    this._checker = file;
    this.signals.emit('patchMeta', { checker: file });
  }
  public get interactor() {
    return this._interactor;
  }
  public set interactor(file: IFileWithHash | undefined) {
    this._interactor = file;
    this.signals.emit('patchMeta', { interactor: file });
  }
  public get bfCompare(): BfCompare {
    return this._bfCompare;
  }
  public set bfCompare(bfCompare: BfCompare) {
    this._bfCompare.signals.off('change', this.bfCompareChanged);
    this._bfCompare = bfCompare;
    this._bfCompare.signals.on('change', this.bfCompareChanged);
  }
  public get timeElapsedMs() {
    return this._timeElapsedMs;
  }

  private onPatchTc(uuid: UUID, payload: Partial<Tc>) {
    this.signals.emit('patchTc', uuid, payload);
  }
  private onPatchTcResult(uuid: UUID, payload: Partial<TcResult>) {
    this.signals.emit('patchTcResult', uuid, payload);
  }

  public addTc(uuid: UUID, tc: Tc) {
    this._tcs.set(uuid, tc);
    this._tcOrder.push(uuid);
    this.signals.emit('addTc', uuid, tc);
    tc.signals.on('patchTc', (payload) => this.onPatchTc(uuid, payload));
    tc.signals.on('patchTcResult', (payload) => this.onPatchTcResult(uuid, payload));
  }
  public getTc(uuid: UUID): Tc {
    const tc = this._tcs.get(uuid);
    if (!tc) throw new Error('Test case not found');
    return tc;
  }
  public deleteTc(uuid: UUID): void {
    this._tcOrder = this._tcOrder.filter((id) => id !== uuid);
  }
  public clearTcs(): string[] {
    const disposables = this.purgeUnusedTcs();
    this._tcOrder = [];
    for (const [id, tc] of this._tcs) {
      disposables.push(...tc.getDisposables());
      this.signals.emit('deleteTc', id);
    }
    this._tcs.clear();
    return disposables;
  }
  public moveTc(fromIdx: number, toIdx: number): void {
    const [movedTc] = this._tcOrder.splice(fromIdx, 1);
    this._tcOrder.splice(toIdx, 0, movedTc);
  }
  public getEnabledTcIds(): UUID[] {
    const enabledIds: UUID[] = [];
    for (const id of this._tcOrder) {
      const tc = this._tcs.get(id);
      if (tc && !tc.isDisabled) enabledIds.push(id);
    }
    return enabledIds;
  }
  public purgeUnusedTcs(): string[] {
    const activeIds = new Set(this._tcOrder);
    const disposables: string[] = [];
    for (const [id, tc] of this._tcs)
      if (!activeIds.has(id)) {
        disposables.push(...tc.getDisposables());
        tc.signals.removeAllListeners();
        this._tcs.delete(id);
      }
    return disposables;
  }
  public clearResult(): string[] {
    const disposables: string[] = [];
    for (const id of this._tcOrder) disposables.push(...this.getTc(id).clearResult());
    return disposables;
  }
  public isRelated(path: string): boolean {
    path = path.toLowerCase();
    if (
      this.src.path === path ||
      this._checker?.path === path ||
      this._interactor?.path === path ||
      this._bfCompare?.bruteForce?.path === path ||
      this._bfCompare?.generator?.path === path
    )
      return true;
    for (const tc of Object.values(this._tcs)) if (tc.isRelated(path)) return true;
    return false;
  }
  public addTimeElapsed(addMs: number) {
    this._timeElapsedMs += addMs;
  }
  public updateResult(...params: Parameters<Tc['updateResult']>) {
    for (const tcId of this._tcOrder) this._tcs.get(tcId)?.updateResult(...params);
  }
}

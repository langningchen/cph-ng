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
import type { BfCompare } from '@/domain/entities/bfCompare';
import type { Tc } from '@/domain/entities/tc';
import type { IFileWithHash, IOverrides } from '@/types';

export class Problem {
  public name: string;
  public url?: string;
  private _tcs: Record<UUID, Tc> = {};
  private _tcOrder: UUID[] = [];
  public readonly src: IFileWithHash;
  private _checker?: IFileWithHash;
  private _interactor?: IFileWithHash;
  private _bfCompare?: BfCompare;
  private _timeElapsedMs: number = 0;
  public overrides: IOverrides = {};

  constructor(name: string, src: string | IFileWithHash) {
    this.name = name;
    if (typeof src === 'string') this.src = { path: src };
    else this.src = src;
  }

  public get tcs(): Readonly<Record<UUID, Tc>> {
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
  }
  public get interactor() {
    return this._interactor;
  }
  public set interactor(file: IFileWithHash | undefined) {
    this._interactor = file;
  }
  public get bfCompare() {
    return this._bfCompare;
  }
  public set bfCompare(bfCompare: BfCompare | undefined) {
    this._bfCompare = bfCompare;
  }
  public get timeElapsedMs() {
    return this._timeElapsedMs;
  }

  public addTc(uuid: UUID, tc: Tc) {
    this._tcs[uuid] = tc;
    this._tcOrder.push(uuid);
  }
  public getTc(uuid: UUID): Tc {
    if (!this._tcs[uuid]) throw new Error('Test case not found');
    return this._tcs[uuid];
  }
  public deleteTc(uuid: UUID): void {
    this._tcOrder = this._tcOrder.filter((id) => id !== uuid);
  }
  public clearTcs(): string[] {
    const disposables = this.purgeUnusedTcs();
    this._tcOrder = [];
    for (const tc of Object.values(this._tcs)) disposables.push(...tc.getDisposables());
    this._tcs = {};
    return disposables;
  }
  public moveTc(fromIdx: number, toIdx: number): void {
    const [movedTc] = this._tcOrder.splice(fromIdx, 1);
    this._tcOrder.splice(toIdx, 0, movedTc);
  }
  public getEnabledTcIds(): UUID[] {
    return this._tcOrder.filter((id) => !this._tcs[id].isDisabled);
  }
  public purgeUnusedTcs(): string[] {
    const activeIds = new Set(this._tcOrder);
    const disposables: string[] = [];
    for (const id of Object.keys(this._tcs) as UUID[])
      if (!activeIds.has(id)) {
        disposables.push(...this._tcs[id].getDisposables());
        delete this._tcs[id];
      }
    return disposables;
  }

  public clearResult(): string[] {
    const disposables: string[] = [];
    for (const id of this._tcOrder) disposables.push(...this._tcs[id].clearResult());
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
    for (const tcId of this._tcOrder) this._tcs[tcId].updateResult(...params);
  }
}

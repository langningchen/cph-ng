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
import { BfCompare } from '@/domain/entities/bfCompare';
import { FileWithHash } from '@/domain/entities/fileWithHash';
import { Tc } from '@/domain/entities/tc';
import type { IOverrides, IProblem, ITc } from '@/types';
import { version } from '@/utils/packageInfo';

export class Problem {
  private _name: string;
  private _url?: string;
  private tcs: Record<UUID, Tc> = {};
  private tcOrder: UUID[] = [];
  private _src: FileWithHash;
  private _checker?: FileWithHash;
  private _interactor?: FileWithHash;
  private _bfCompare?: BfCompare;
  private timeElapsedMs: number = 0;
  private _overrides?: IOverrides;

  constructor(name: string, src: string) {
    this._name = name;
    this._src = new FileWithHash(src);
  }

  public static fromI(problem: IProblem): Problem {
    const instance = new Problem(problem.name, problem.src.path);
    instance.fromI(problem);
    return instance;
  }
  public fromI(problem: IProblem): void {
    this._name = problem.name;
    this._url = problem.url;
    (Object.entries(problem.tcs) as [UUID, ITc][]).forEach(([id, tc]) => {
      this.tcs[id] = Tc.fromI(tc);
    });
    this.tcOrder = [...problem.tcOrder];
    this._src = FileWithHash.fromI(problem.src);
    if (problem.checker) this._checker = FileWithHash.fromI(problem.checker);
    if (problem.interactor) this._interactor = FileWithHash.fromI(problem.interactor);
    if (problem.bfCompare) this._bfCompare = BfCompare.fromI(problem.bfCompare);
    this.timeElapsedMs = problem.timeElapsed;
    if (problem.overrides) this._overrides = { ...problem.overrides };
  }

  get name() {
    return this._name;
  }
  get url() {
    return this._url;
  }
  get src() {
    return this._src;
  }
  get checker() {
    return this._checker;
  }
  get interactor() {
    return this._interactor;
  }
  get bfCompare() {
    return this._bfCompare;
  }
  get overrides() {
    return this._overrides;
  }

  public addTc(uuid: UUID, tc: Tc) {
    this.tcs[uuid] = tc;
    this.tcOrder.push(uuid);
  }
  public getTc(uuid: UUID): Tc {
    if (!this.tcs[uuid]) throw new Error('Test case not found');
    return this.tcs[uuid];
  }
  public clearTcs() {
    this.tcOrder = [];
  }
  public getEnabledTcIds(): UUID[] {
    return this.tcOrder.filter((id) => !this.tcs[id].isDisabled);
  }
  public purgeUnusedTcs(): string[] {
    const activeIds = new Set(this.tcOrder);
    const disposables: string[] = [];
    for (const id of Object.keys(this.tcs) as UUID[])
      if (!activeIds.has(id)) {
        disposables.push(...this.tcs[id].getDisposables());
        delete this.tcs[id];
      }
    return disposables;
  }

  public clearResult(): string[] {
    const disposables: string[] = [];
    for (const id of this.tcOrder) disposables.push(...this.tcs[id].clearResult());
    return disposables;
  }

  public isRelated(path: string): boolean {
    if (
      this._src.path.toLowerCase() === path ||
      this._checker?.path.toLowerCase() === path ||
      this._interactor?.path.toLowerCase() === path ||
      this._bfCompare?.bruteForce?.path.toLowerCase() === path ||
      this._bfCompare?.generator?.path.toLowerCase() === path
    )
      return true;
    for (const tc of Object.values(this.tcs)) if (tc.isRelated(path)) return true;
    return false;
  }

  public addTimeElapsed(addMs: number) {
    this.timeElapsedMs += addMs;
  }
  public updateResult(...params: Parameters<Tc['updateResult']>) {
    for (const tcId of this.tcOrder) this.tcs[tcId].updateResult(...params);
  }

  public toJSON(): IProblem {
    const tcs: Record<UUID, ITc> = {};
    for (const [id, tc] of Object.entries(this.tcs) as [UUID, Tc][]) tcs[id] = tc.toJSON();
    return {
      version,
      name: this._name,
      url: this._url,
      tcs,
      tcOrder: this.tcOrder,
      src: this._src.toJSON(),
      checker: this._checker?.toJSON(),
      interactor: this._interactor?.toJSON(),
      bfCompare: this._bfCompare ? { ...this._bfCompare } : undefined,
      timeElapsed: this.timeElapsedMs,
      overrides: this._overrides ? { ...this._overrides } : undefined,
    };
  }
}

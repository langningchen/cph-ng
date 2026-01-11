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

import type { IFileWithHash } from '@/domain/types';

export const BfCompareState = {
  inactive: 'inactive',
  compiling: 'compiling',
  compilationError: 'compilationError',
  generating: 'generating',
  runningBruteForce: 'runningBruteForce',
  runningSolution: 'runningSolution',
  foundDifference: 'foundDifference',
  internalError: 'internalError',
} as const;
export type BfCompareState = (typeof BfCompareState)[keyof typeof BfCompareState];

export class BfCompare {
  constructor(
    public generator?: IFileWithHash,
    public bruteForce?: IFileWithHash,
    public cnt: number = 0,
    private _state: BfCompareState = BfCompareState.inactive,
    private _msg?: string,
  ) {}

  public error(e: Error) {
    this.state = BfCompareState.internalError;
    this._msg = e.message;
  }

  get state(): BfCompareState {
    return this._state;
  }
  set state(value: BfCompareState) {
    this._state = value;
    this._msg = undefined;
  }
  get msg(): string | undefined {
    return this._msg;
  }
  get isRunning(): boolean {
    return (
      this.state === BfCompareState.compiling ||
      this.state === BfCompareState.generating ||
      this.state === BfCompareState.runningBruteForce ||
      this.state === BfCompareState.runningSolution
    );
  }
}

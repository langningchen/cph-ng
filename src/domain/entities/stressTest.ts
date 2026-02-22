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

import { EventEmitter } from 'node:events';
import type { IFileWithHash } from '@/domain/types';

export const StressTestState = {
  inactive: 'inactive',
  compiling: 'compiling',
  compilationError: 'compilationError',
  generating: 'generating',
  runningBruteForce: 'runningBruteForce',
  runningSolution: 'runningSolution',
  foundDifference: 'foundDifference',
  internalError: 'internalError',
} as const;
export type StressTestState = (typeof StressTestState)[keyof typeof StressTestState];

const RunningSet = new Set<StressTestState>([
  StressTestState.compiling,
  StressTestState.generating,
  StressTestState.runningBruteForce,
  StressTestState.runningSolution,
]);
export const isRunningState = (state?: StressTestState): boolean => {
  return state !== undefined && RunningSet.has(state);
};

export interface StressTestEvents {
  change: [Partial<StressTest>];
}

export class StressTest {
  public readonly signals: EventEmitter<StressTestEvents> = new EventEmitter();

  public constructor(
    private _generator: IFileWithHash | null = null,
    private _bruteForce: IFileWithHash | null = null,
    private _cnt: number = 0,
    private _state: StressTestState = StressTestState.inactive,
  ) {}

  public get generator(): IFileWithHash | null {
    return this._generator;
  }
  public set generator(value: IFileWithHash | null) {
    this._generator = value;
    this.signals.emit('change', { generator: value });
  }
  public get bruteForce(): IFileWithHash | null {
    return this._bruteForce;
  }
  public set bruteForce(value: IFileWithHash | null) {
    this._bruteForce = value;
    this.signals.emit('change', { bruteForce: value });
  }
  public get state(): StressTestState {
    return this._state;
  }
  public set state(value: StressTestState) {
    this._state = value;
    // We need to emit both cnt and state for the translator to update the message correctly
    this.signals.emit('change', { cnt: this._cnt, state: this._state });
  }
  public get cnt(): number {
    return this._cnt;
  }
  public get isRunning(): boolean {
    return (
      this.state === StressTestState.compiling ||
      this.state === StressTestState.generating ||
      this.state === StressTestState.runningBruteForce ||
      this.state === StressTestState.runningSolution
    );
  }

  public clearCnt() {
    this._cnt = 0;
    this.signals.emit('change', { cnt: this._cnt, state: this._state });
  }
  public count() {
    this._cnt++;
    this.signals.emit('change', { cnt: this._cnt, state: this._state });
  }
}

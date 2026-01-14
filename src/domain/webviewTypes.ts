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
import type { BfCompareState } from '@/domain/entities/bfCompare';
import type { VerdictName } from '@/domain/entities/verdict';

export type IWebviewTcIo = { data: string } | { path: string; base: string };

export interface IWebviewTcResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  stdout?: IWebviewTcIo;
  stderr?: IWebviewTcIo;
  msg?: string;
}
export interface IWebviewTc {
  stdin: IWebviewTcIo;
  answer: IWebviewTcIo;
  isExpand: boolean;
  isDisabled: boolean;
  result?: IWebviewTcResult;
}

export interface IWebviewFileWithHash {
  path: string;
  base: string;
}

export interface IWebviewBfCompare {
  generator?: IWebviewFileWithHash;
  bruteForce?: IWebviewFileWithHash;
  cnt: number;
  state: BfCompareState;
}

export interface IWebviewOverride<T> {
  defaultValue: T;
  override?: T;
}

export interface IWebviewOverrides {
  timeLimitMs: IWebviewOverride<number>;
  memoryLimitMb: IWebviewOverride<number>;
  compiler?: IWebviewOverride<string>;
  compilerArgs?: IWebviewOverride<string>;
  runner?: IWebviewOverride<string>;
  runnerArgs?: IWebviewOverride<string>;
}

export interface IWebviewProblem {
  name: string;
  url?: string;
  tcs: Record<UUID, IWebviewTc>;
  tcOrder: UUID[];
  src: IWebviewFileWithHash;
  checker?: IWebviewFileWithHash;
  interactor?: IWebviewFileWithHash;
  bfCompare?: IWebviewBfCompare;
  timeElapsedMs: number;
  overrides: IWebviewOverrides;
}

export interface IWebviewBackgroundProblem {
  name: string;
  srcPath: string;
}

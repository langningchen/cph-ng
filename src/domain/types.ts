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

export type ITcIo = { data: string } | { path: string };

export interface ITcResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  stdout?: ITcIo;
  stderr?: ITcIo;
  msg?: string;
}
export interface ITc {
  stdin: ITcIo;
  answer: ITcIo;
  isExpand: boolean;
  isDisabled: boolean;
  result?: ITcResult;
}

export interface IFileWithHash {
  path: string;
  hash?: string;
}

export interface IBfCompare {
  generator: IFileWithHash | null;
  bruteForce: IFileWithHash | null;
  cnt: number;
  state: BfCompareState;
}

export interface IOverrides {
  timeLimitMs?: number;
  memoryLimitMb?: number;
  compiler?: string;
  compilerArgs?: string;
  runner?: string;
  runnerArgs?: string;
}

export interface IProblem {
  version: string;
  name: string;
  url?: string;
  tcs: Record<UUID, ITc>;
  tcOrder: UUID[];
  src: IFileWithHash;
  checker?: IFileWithHash;
  interactor?: IFileWithHash;
  bfCompare: IBfCompare;
  timeElapsedMs: number;
  overrides: IOverrides;
}

export interface ICphProblem {
  name: string;
  url: string;
  tests: { id: number; input: string; output: string }[];
  interactive: boolean;
  memoryLimit: number;
  timeLimit: number;
  srcPath: string;
  group: string;
  local: boolean;
}

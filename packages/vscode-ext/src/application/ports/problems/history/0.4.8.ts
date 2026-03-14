// Copyright (C) 2025 Langning Chen
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

interface ITcVerdict {
  name: string;
  fullName: string;
  color: string;
}

export interface ITcIo {
  useFile: boolean;
  data: string;
}

interface ITcResult {
  verdict: ITcVerdict;
  time?: number;
  memory?: number;
  stdout: ITcIo;
  stderr: ITcIo;
  msg: string[];
}
interface ITc {
  stdin: ITcIo;
  answer: ITcIo;
  isExpand: boolean;
  isDisabled: boolean;
  result?: ITcResult;
}

interface IFileWithHash {
  path: string;
  hash?: string;
}

interface IBfCompare {
  generator?: IFileWithHash;
  bruteForce?: IFileWithHash;
  running: boolean;
  msg: string;
}

interface ICompilationSettings {
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
  timeLimit: number;
  memoryLimit: number;
  src: IFileWithHash;
  checker?: IFileWithHash;
  interactor?: IFileWithHash;
  bfCompare?: IBfCompare;
  timeElapsed: number;
  compilationSettings?: ICompilationSettings;
}

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

import { UUID } from 'crypto';

export const isRunningVerdict = (verdict?: ITcVerdict): boolean => {
  return (
    verdict !== undefined &&
    ['WT', 'CP', 'CPD', 'JG', 'JGD', 'CMP'].includes(verdict?.name)
  );
};
export const isExpandVerdict = (verdict?: ITcVerdict): boolean => {
  return !(
    (verdict !== undefined && ['AC', 'SK', 'RJ'].includes(verdict.name)) ||
    isRunningVerdict(verdict)
  );
};

export interface ITcVerdict {
  name: string;
  fullName: string;
  color: string;
}

export interface ITcIo {
  useFile: boolean;
  data: string;
}

export interface ITcResult {
  verdict: ITcVerdict;
  time?: number;
  memory?: number;
  stdout: ITcIo;
  stderr: ITcIo;
  msg: string[];
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
  generator?: IFileWithHash;
  bruteForce?: IFileWithHash;
  running: boolean;
  msg: string;
}

export interface ICompilationSettings {
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

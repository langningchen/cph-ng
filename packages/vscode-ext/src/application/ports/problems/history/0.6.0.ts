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

export const VerdictName = {
  unknownError: 'UKE',
  accepted: 'AC',
  partiallyCorrect: 'PC',
  presentationError: 'PE',
  wrongAnswer: 'WA',
  timeLimitExceed: 'TLE',
  memoryLimitExceed: 'MLE',
  outputLimitExceed: 'OLE',
  runtimeError: 'RE',
  restrictedFunction: 'RF',
  compilationError: 'CE',
  systemError: 'SE',
  waiting: 'WT',
  fetched: 'FC',
  compiling: 'CP',
  compiled: 'CPD',
  judging: 'JG',
  judged: 'JGD',
  comparing: 'CMP',
  skipped: 'SK',
  rejected: 'RJ',
} as const;
export type VerdictName = (typeof VerdictName)[keyof typeof VerdictName];

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

declare const BrandSym: unique symbol;
type Branded<T, Label> = T & { [BrandSym]?: Label };
export type ProblemId = Branded<UUID, 'ProblemId'>;
export type TestcaseId = Branded<UUID, 'TestcaseId'>;
export type ClientId = Branded<UUID, 'ClientId'>;
export type SubmissionId = Branded<UUID, 'SubmissionId'>;
export type BatchId = Branded<UUID, 'BatchId'>;

export type WithRevision<T> = T & { revision: number };

export type ITestcaseIo = { data: string } | { path: string };

export interface ITestcaseResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  stdout?: ITestcaseIo;
  stderr?: ITestcaseIo;
  msg?: string;
}
export interface ITestcase {
  stdin: ITestcaseIo;
  answer: ITestcaseIo;
  isExpand: boolean;
  isDisabled: boolean;
  result?: ITestcaseResult;
}

export interface IFileWithHash {
  path: string;
  hash?: string;
}

export interface IStressTest {
  generator: IFileWithHash | null;
  bruteForce: IFileWithHash | null;
  cnt: number;
  state: StressTestState;
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
  testcases: Record<TestcaseId, ITestcase>;
  testcaseOrder: TestcaseId[];
  src: IFileWithHash;
  checker: IFileWithHash | null;
  interactor: IFileWithHash | null;
  stressTest: IStressTest;
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

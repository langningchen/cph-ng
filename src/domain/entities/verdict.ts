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

export const VerdictType = {
  running: 'RUNNING',
  passed: 'PASSED',
  failed: 'FAILED',
};
export type VerdictType = (typeof VerdictType)[keyof typeof VerdictType];

export interface Verdict {
  name: VerdictName;
  fullName: string;
  color: string;
  type: VerdictType;
}

export const Verdicts: Record<VerdictName, Verdict> = {
  [VerdictName.unknownError]: {
    name: VerdictName.unknownError,
    fullName: 'Unknown Error',
    color: '#0000ff',
    type: VerdictType.failed,
  },
  [VerdictName.accepted]: {
    name: VerdictName.accepted,
    fullName: 'Accepted',
    color: '#49cd32',
    type: VerdictType.passed,
  },
  [VerdictName.partiallyCorrect]: {
    name: VerdictName.partiallyCorrect,
    fullName: 'Partially Correct',
    color: '#ed9813',
    type: VerdictType.failed,
  },
  [VerdictName.presentationError]: {
    name: VerdictName.presentationError,
    fullName: 'Presentation Error',
    color: '#ff778e',
    type: VerdictType.failed,
  },
  [VerdictName.wrongAnswer]: {
    name: VerdictName.wrongAnswer,
    fullName: 'Wrong Answer',
    color: '#d3140d',
    type: VerdictType.failed,
  },
  [VerdictName.timeLimitExceed]: {
    name: VerdictName.timeLimitExceed,
    fullName: 'Time Limit Exceed',
    color: '#0c0066',
    type: VerdictType.failed,
  },
  [VerdictName.memoryLimitExceed]: {
    name: VerdictName.memoryLimitExceed,
    fullName: 'Memory Limit Exceed',
    color: '#5300a7',
    type: VerdictType.failed,
  },
  [VerdictName.outputLimitExceed]: {
    name: VerdictName.outputLimitExceed,
    fullName: 'Output Limit Exceed',
    color: '#8300a7',
    type: VerdictType.failed,
  },
  [VerdictName.runtimeError]: {
    name: VerdictName.runtimeError,
    fullName: 'Runtime Error',
    color: '#1a26c8',
    type: VerdictType.failed,
  },
  [VerdictName.restrictedFunction]: {
    name: VerdictName.restrictedFunction,
    fullName: 'Restricted Function',
    color: '#008f81',
    type: VerdictType.failed,
  },
  [VerdictName.compilationError]: {
    name: VerdictName.compilationError,
    fullName: 'Compilation Error',
    color: '#8b7400',
    type: VerdictType.failed,
  },
  [VerdictName.systemError]: {
    name: VerdictName.systemError,
    fullName: 'System Error',
    color: '#000000',
    type: VerdictType.failed,
  },
  [VerdictName.waiting]: {
    name: VerdictName.waiting,
    fullName: 'Waiting',
    color: '#4100d9',
    type: VerdictType.running,
  },
  [VerdictName.fetched]: {
    name: VerdictName.fetched,
    fullName: 'Fetched',
    color: '#4c00ff',
    type: VerdictType.running,
  },
  [VerdictName.compiling]: {
    name: VerdictName.compiling,
    fullName: 'Compiling',
    color: '#5e19ff',
    type: VerdictType.running,
  },
  [VerdictName.compiled]: {
    name: VerdictName.compiled,
    fullName: 'Compiled',
    color: '#7340ff',
    type: VerdictType.running,
  },
  [VerdictName.judging]: {
    name: VerdictName.judging,
    fullName: 'Judging',
    color: '#844fff',
    type: VerdictType.running,
  },
  [VerdictName.judged]: {
    name: VerdictName.judged,
    fullName: 'Judged',
    color: '#967fff',
    type: VerdictType.running,
  },
  [VerdictName.comparing]: {
    name: VerdictName.comparing,
    fullName: 'Comparing',
    color: '#a87dff',
    type: VerdictType.running,
  },
  [VerdictName.skipped]: {
    name: VerdictName.skipped,
    fullName: 'Skipped',
    color: '#4b4b4b',
    type: VerdictType.passed,
  },
  [VerdictName.rejected]: {
    name: VerdictName.rejected,
    fullName: 'Rejected',
    color: '#4e0000',
    type: VerdictType.passed,
  },
};

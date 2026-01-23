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

interface PartialVerdict {
  name: VerdictName;
  color: string;
  type: VerdictType;
}
export interface Verdict extends PartialVerdict {
  fullName: string;
}

export const Verdicts: Record<VerdictName, PartialVerdict> = {
  [VerdictName.unknownError]: {
    name: VerdictName.unknownError,
    color: '#0000ff',
    type: VerdictType.failed,
  },
  [VerdictName.accepted]: {
    name: VerdictName.accepted,
    color: '#49cd32',
    type: VerdictType.passed,
  },
  [VerdictName.partiallyCorrect]: {
    name: VerdictName.partiallyCorrect,
    color: '#ed9813',
    type: VerdictType.failed,
  },
  [VerdictName.presentationError]: {
    name: VerdictName.presentationError,
    color: '#ff778e',
    type: VerdictType.failed,
  },
  [VerdictName.wrongAnswer]: {
    name: VerdictName.wrongAnswer,
    color: '#d3140d',
    type: VerdictType.failed,
  },
  [VerdictName.timeLimitExceed]: {
    name: VerdictName.timeLimitExceed,
    color: '#0c0066',
    type: VerdictType.failed,
  },
  [VerdictName.memoryLimitExceed]: {
    name: VerdictName.memoryLimitExceed,
    color: '#5300a7',
    type: VerdictType.failed,
  },
  [VerdictName.outputLimitExceed]: {
    name: VerdictName.outputLimitExceed,
    color: '#8300a7',
    type: VerdictType.failed,
  },
  [VerdictName.runtimeError]: {
    name: VerdictName.runtimeError,
    color: '#1a26c8',
    type: VerdictType.failed,
  },
  [VerdictName.restrictedFunction]: {
    name: VerdictName.restrictedFunction,
    color: '#008f81',
    type: VerdictType.failed,
  },
  [VerdictName.compilationError]: {
    name: VerdictName.compilationError,
    color: '#8b7400',
    type: VerdictType.failed,
  },
  [VerdictName.systemError]: {
    name: VerdictName.systemError,
    color: '#000000',
    type: VerdictType.failed,
  },
  [VerdictName.waiting]: {
    name: VerdictName.waiting,
    color: '#4100d9',
    type: VerdictType.running,
  },
  [VerdictName.fetched]: {
    name: VerdictName.fetched,
    color: '#4c00ff',
    type: VerdictType.running,
  },
  [VerdictName.compiling]: {
    name: VerdictName.compiling,
    color: '#5e19ff',
    type: VerdictType.running,
  },
  [VerdictName.compiled]: {
    name: VerdictName.compiled,
    color: '#7340ff',
    type: VerdictType.running,
  },
  [VerdictName.judging]: {
    name: VerdictName.judging,
    color: '#844fff',
    type: VerdictType.running,
  },
  [VerdictName.judged]: {
    name: VerdictName.judged,
    color: '#967fff',
    type: VerdictType.running,
  },
  [VerdictName.comparing]: {
    name: VerdictName.comparing,
    color: '#a87dff',
    type: VerdictType.running,
  },
  [VerdictName.skipped]: {
    name: VerdictName.skipped,
    color: '#4b4b4b',
    type: VerdictType.passed,
  },
  [VerdictName.rejected]: {
    name: VerdictName.rejected,
    color: '#4e0000',
    type: VerdictType.passed,
  },
};

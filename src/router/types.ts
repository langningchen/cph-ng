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

import type { BatchId, ClientId, SubmissionId } from '@/domain/types';

export interface Config {
  port: number;
  logFile: string;
  shutdownTimeout: number;
}

export interface CompanionProblem {
  name: string;
  group: string;
  url: string;
  interactive: boolean;
  memoryLimit: number;
  timeLimit: number;
  tests: {
    input: string;
    output: string;
  }[];
  testType: 'single' | 'multiNumber';
  input: {
    type: 'stdin' | 'file' | 'regex';
    fileName?: string;
    pattern?: string;
  };
  output: {
    type: 'stdout' | 'file';
    fileName?: string;
  };
  languages: {
    java: {
      mainClass: string;
      taskClass: string;
    };
  };
  batch: {
    id: BatchId;
    size: number;
  };
}

export type CphSubmitEmpty = {
  empty: true;
};
export type CphSubmitData = {
  empty: false;
  problemName: string;
  url: string;
  sourceCode: string;
  languageId: number;
};
export type CphSubmitResponse = CphSubmitEmpty | CphSubmitData;

export interface CompanionMsgBase {
  type: string;
}
export interface ReadingBatchMsg extends CompanionMsgBase {
  type: 'readingBatch';
  batchId: BatchId;
  count: number;
  size: number;
}
export interface BatchAvailableMsg extends CompanionMsgBase {
  type: 'batchAvailable';
  batchId: BatchId;
  problems: CompanionProblem[];
  autoImport: boolean;
}
export interface BatchClaimedMsg extends CompanionMsgBase {
  type: 'batchClaimed';
  batchId: BatchId;
}
export interface SubmissionConsumedMsg extends CompanionMsgBase {
  type: 'submissionConsumed';
  submissionId: SubmissionId;
}
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export interface LogMsg extends CompanionMsgBase {
  type: 'log';
  level: LogLevel;
  message: string;
  details?: unknown;
}
export type CompanionMsg =
  | ReadingBatchMsg
  | BatchAvailableMsg
  | BatchClaimedMsg
  | SubmissionConsumedMsg
  | LogMsg;

export interface CompanionClientMsgBase {
  type: string;
  clientId: ClientId;
}
export interface CancelBatchMsg extends CompanionClientMsgBase {
  type: 'cancelBatch';
  batchId: BatchId;
}
export interface ClaimBatchMsg extends CompanionClientMsgBase {
  type: 'claimBatch';
  batchId: BatchId;
}
export interface SubmitMsg extends CompanionClientMsgBase {
  type: 'submit';
  submissionId: SubmissionId;
  data: CphSubmitData;
}
export interface CancelSubmitMsg extends CompanionClientMsgBase {
  type: 'cancelSubmit';
  submissionId: SubmissionId;
}
export interface UpdateConfigMsg extends CompanionClientMsgBase {
  type: 'updateConfig';
  config: Partial<Config>;
}
export type CompanionClientMsg =
  | CancelBatchMsg
  | ClaimBatchMsg
  | SubmitMsg
  | CancelSubmitMsg
  | UpdateConfigMsg;

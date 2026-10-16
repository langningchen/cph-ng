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

import type { BatchId } from './types';

// Router Config
export interface RouterConfig {
  port: number;
  logFile: string;
}

// Companion Problem
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

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export interface SubmitData {
  url: string;
  sourceCode: string;
}

// Router -> Client
export interface R2cMsg {
  readingBatch: (msg: { batchId: BatchId; count: number; size: number }) => void;
  batchAvailable: (msg: {
    batchId: BatchId;
    problems: CompanionProblem[];
    autoImport: boolean;
  }) => void;
  batchClaimed: (msg: { batchId: BatchId }) => void;
  log: (msg: { level: LogLevel; message: string; details?: unknown }) => void;
  browserStatus: (msg: { connected: boolean }) => void;
}

// Router -> Browser messages
export interface R2bMsg {
  submitRequest: (msg: SubmitData) => void;
  status: (msg: { isActive: boolean }) => void;
}

// Client -> Router Messages
export interface C2rMsg {
  cancelBatch: (msg: { batchId: BatchId }) => void;
  claimBatch: (msg: { batchId: BatchId }) => void;
  submit: (msg: SubmitData) => void;
  updateConfig: (msg: { config: Partial<RouterConfig> }) => void;
}

// Browser -> Router Messages
export interface B2rMsg {
  setActive: () => void;
}

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

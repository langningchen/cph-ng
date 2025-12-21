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

import type { ITcIo } from '@/types';

export interface ExecutionContext {
  cmd: string[];
  stdin: ITcIo;
  timeLimitMs: number;
  memoryLimitMb?: number;
}

export interface ExecutionData {
  codeOrSignal: number | string;
  stdoutPath: string;
  stderrPath: string;
  timeMs: number;
  memoryMb?: number;
  isAborted: boolean;
}

export type ExecutionResult = ExecutionData | Error;

export interface InteractiveExecutionResult {
  sol: ExecutionResult;
  int: ExecutionResult;
  feedbackPath: string;
}

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

export interface ExecutionContext {
  cmd: string[];
  stdinPath: string;
  timeLimitMs: number;
  memoryLimitMb?: number;
}

export interface ExecutionData {
  codeOrSignal: number | string;
  stdoutPath: string;
  stderrPath: string;
  timeMs: number;
  memoryMb?: number;
  isUserAborted: boolean;
}

export class ExecutionRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionRejected';
  }
}

export type ExecutionResult = ExecutionData | ExecutionRejected | Error;

export interface InteractiveExecutionData {
  sol: ExecutionData;
  int: ExecutionData;
  feedbackPath: string;
}

export type InteractiveExecutionResult = InteractiveExecutionData | Error;

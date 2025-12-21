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

import type { TcIo } from '@/types';

export enum AbortReason {
  UserAbort = 'user_abort',
  Timeout = 'timeout',
}

export interface ProcessOptions {
  cmd: string[];
  cwd?: string;
  timeoutMs?: number;
  ac?: AbortController;
  stdin?: TcIo;
}

export interface PipeProcessOptions {
  cmd: string[];
  cwd?: string;
  timeoutMs?: number;
  ac?: AbortController;
}

export interface ProcessHandle {
  pid: number;
  stdoutPath: string;
  stderrPath: string;
  writeStdin(input: string): void;
  closeStdin(): void;
  kill(signal?: NodeJS.Signals): void;
  wait(): Promise<ProcessExecuteResult>;
}

export interface ProcessOutput {
  codeOrSignal: number | string;
  stdoutPath: string;
  stderrPath: string;
  timeMs: number;
  memoryMb?: number;
  abortReason?: AbortReason;
}

export type ProcessExecuteResult = ProcessOutput | Error;

export interface IProcessExecutor {
  spawn(options: ProcessOptions): Promise<ProcessHandle>;
  execute(options: ProcessOptions): Promise<ProcessExecuteResult>;
  executeWithPipe(
    opt1: PipeProcessOptions,
    opt2: PipeProcessOptions,
  ): Promise<{ res1: ProcessExecuteResult; res2: ProcessExecuteResult }>;
}

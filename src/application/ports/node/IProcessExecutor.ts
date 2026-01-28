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

export enum AbortReason {
  UserAbort = 'user_abort',
  Timeout = 'timeout',
}

/** Options for executing a process. */
export interface ProcessOptions {
  /** Command and arguments to execute. */
  cmd: string[];

  /** Timeout in milliseconds. */
  timeoutMs?: number;

  /** Abort signal to cancel the process. */
  signal?: AbortSignal;

  /** Path to a file to use as standard input. */
  stdinPath?: string;

  /** Environment variables for the process. */
  env?: Record<string, string>;
}

/** Options for executing a process with piping. */
export interface PipeProcessOptions {
  /** Command and arguments to execute. */
  cmd: string[];

  /** Timeout in milliseconds. */
  timeoutMs?: number;

  /** Abort signal to cancel the process. */
  signal?: AbortSignal;
}

/** Handle to a spawned process, created by {@link IProcessExecutor.spawn}. */
export interface ProcessHandle {
  /** The process ID of the spawned process. */
  pid: number;

  /** Path to the file where standard output is being written. */
  stdoutPath: string;

  /** Path to the file where standard error is being written. */
  stderrPath: string;

  /** Writes input to the standard input of the process. */
  writeStdin(input: string): void;

  /** Closes the standard input of the process. */
  closeStdin(): void;

  /**
   * Sends a signal to the process.
   * @param signal The signal to send.
   */
  kill(signal?: NodeJS.Signals): void;

  /** Waits for the process to complete and returns the execution result. */
  wait: Promise<ProcessExecuteResult>;
}

/** Output of a process execution. */
export interface ProcessOutput {
  /**
   * Exit code or signal of the process.
   * @remarks
   * - If it's a `number`, it represents the exit status code (0 for success).
   * - If it's a `string`, it represents the signal that terminated the process (e.g., 'SIGTERM').
   */
  codeOrSignal: number | string;

  /** Path to the file where standard output is being written. */
  stdoutPath: string;

  /** Path to the file where standard error is being written. */
  stderrPath: string;

  /** Execution time in milliseconds. */
  timeMs: number;

  /** Reason for abortion, if the process was aborted. */
  abortReason?: AbortReason;
}

/** Result of executing a process, either successful output or an error if the process failed to start. */
export type ProcessExecuteResult = ProcessOutput | Error;

/**
 * Interface for executing system processes.
 * @remarks This interface provides methods to spawn and execute system processes,
 * including support for piping between processes.
 */
export interface IProcessExecutor {
  /**
   * Spawns a new process.
   * @returns A handle to the spawned process.
   */
  spawn(options: ProcessOptions): ProcessHandle;

  /**
   * Executes a process and waits for it to complete.
   * @returns Resolves with the result of the process execution.
   */
  execute(options: ProcessOptions): Promise<ProcessExecuteResult>;

  /**
   * Executes two processes with a bi-directional pipe between them.
   * @param opt1 Options for the first process in the pipe.
   * @param opt2 Options for the second process in the pipe.
   * @remarks The stdout of any process will be piped to the stdin of the other process.
   * @returns Resolves with the results of both process executions.
   */
  executeWithPipe(
    opt1: PipeProcessOptions,
    opt2: PipeProcessOptions,
  ): Promise<{ res1: ProcessExecuteResult; res2: ProcessExecuteResult }>;
}

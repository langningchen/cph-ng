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

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { inject, injectable } from 'tsyringe';
import type { IClock } from '@/application/ports/node/IClock';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessExecuteResult,
  type ProcessHandle,
  type ProcessOptions,
  type ProcessOutput,
} from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';

// https://nodejs.org/docs/latest/api/child_process.html#event-close
// "One of the two will always be non-null."
// So we can use number | NodeJS.Signals to represent both exit code and signal.

interface LaunchResult {
  child: ChildProcessWithoutNullStreams;
  timeoutId?: NodeJS.Timeout;
  acSignal: AbortSignal;
  stdoutPath: string;
  stderrPath: string;
  startTime: number;
  endTime?: number;
  memoryMb?: number;
  ioPromises: Promise<void>[];
}

@injectable()
export class ProcessExecutorAdapter implements IProcessExecutor {
  constructor(
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.Clock) private readonly clock: IClock,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
  ) {
    this.logger = this.logger.withScope('processExecutor');
  }

  public async execute(options: ProcessOptions): Promise<ProcessExecuteResult> {
    this.logger.trace('execute', options);
    const launch = this.internalLaunch(options);
    return new Promise((resolve) => {
      launch.child.on('close', async (code, signal) => {
        resolve(await this.collectResult(launch, code ?? signal ?? -1));
      });
      launch.child.on('error', async (error) => {
        this.tmp.dispose([launch.stdoutPath, launch.stderrPath]);
        error.name === 'AbortError' || resolve(this.collectError(error));
      });
    });
  }

  public async spawn(options: ProcessOptions): Promise<ProcessHandle> {
    this.logger.trace('spawn', options);
    const launch = this.internalLaunch(options);

    return {
      pid: launch.child.pid ?? -1,
      stdoutPath: launch.stdoutPath,
      stderrPath: launch.stderrPath,

      writeStdin: (input: string) => {
        if (launch.child.stdin && !launch.child.stdin.destroyed) {
          launch.child.stdin.write(input);
        }
      },

      closeStdin: () => {
        if (launch.child.stdin && !launch.child.stdin.destroyed) {
          launch.child.stdin.end();
        }
      },

      kill: (signal?: NodeJS.Signals) => {
        launch.child.kill(signal || 'SIGTERM');
      },

      wait: () => {
        return new Promise((resolve) => {
          launch.child.on('close', async (code, signal) => {
            resolve(await this.collectResult(launch, code ?? signal ?? -1));
          });
          launch.child.on('error', (error) => {
            this.tmp.dispose([launch.stderrPath, launch.stdoutPath]);
            resolve(this.collectError(error));
          });
        });
      },
    };
  }

  private internalLaunch(options: ProcessOptions): LaunchResult {
    this.logger.trace('createProcess', options);
    const { cmd, ac, timeoutMs: timeout, stdinPath } = options;

    // Use a unified AbortController to handle both external and internal aborts
    const unifiedAc = new AbortController();
    if (ac) {
      ac.signal.addEventListener('abort', () =>
        unifiedAc.abort(AbortReason.UserAbort),
      );
    }

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: cmd[0] ? this.fs.dirname(cmd[0]) : this.fs.cwd(),
      signal: unifiedAc.signal,
    });
    this.logger.info('Running executable', options, child.pid);
    const result: LaunchResult = {
      child,
      acSignal: unifiedAc.signal,
      stdoutPath: this.tmp.create(),
      stderrPath: this.tmp.create(),
      startTime: Date.now(),
      ioPromises: [],
    };

    // Process timeout
    if (timeout) {
      result.timeoutId = setTimeout(() => {
        this.logger.warn(`Process ${child.pid} reached timeout ${timeout}ms`);
        unifiedAc.abort(AbortReason.Timeout);
      }, timeout);
    }

    // Process stdio
    if (stdinPath) {
      result.ioPromises.push(
        pipeline(createReadStream(stdinPath), child.stdin).catch(
          this.pipeFailed(child.pid, 'stdin'),
        ),
      );
    }
    result.ioPromises.push(
      pipeline(child.stdout, createWriteStream(result.stdoutPath)).catch(
        this.pipeFailed(child.pid, 'stdout'),
      ),
      pipeline(child.stderr, createWriteStream(result.stderrPath)).catch(
        this.pipeFailed(child.pid, 'stderr'),
      ),
    );
    return result;
  }

  private async collectResult(
    launch: LaunchResult,
    data: number | NodeJS.Signals,
  ): Promise<ProcessOutput> {
    this.logger.trace('collectResult', { launch, data });
    if (launch.timeoutId) clearTimeout(launch.timeoutId);
    await Promise.all(launch.ioPromises);
    this.logger.debug(`Process ${launch.child.pid} close`, data);
    return {
      codeOrSignal: data,
      stdoutPath: launch.stdoutPath,
      stderrPath: launch.stderrPath,
      // A fallback for time if not set
      timeMs: (launch.endTime ?? this.clock.now()) - launch.startTime,
      memoryMb: launch.memoryMb,
      abortReason: launch.acSignal.reason as AbortReason | undefined,
    };
  }

  private collectError(data: Error | string): Error {
    this.logger.trace('collectError', { data });
    if (data instanceof Error) {
      return data;
    }
    return new Error(data);
  }

  private pipeFailed(pid: number | undefined, name: string) {
    return (e: unknown) => {
      const expectedErrors = [
        'ENOENT',
        'EOF',
        'EPERM',
        'EPIPE',
        'ERR_STREAM_PREMATURE_CLOSE',
        'ERR_STREAM_WRITE_AFTER_END',
      ];
      const code = (e as { code?: string })?.code;
      if (code && expectedErrors.includes(code)) {
        this.logger.trace(`Pipe ${name} of process ${pid} closed prematurely`);
      } else {
        this.logger.warn('Set up process', pid, name, 'failed', e);
        this.telemetry.error('pipeFailed', e, { name });
      }
    };
  }

  public async executeWithPipe(
    opt1: ProcessOptions,
    opt2: ProcessOptions,
  ): Promise<{ res1: ProcessExecuteResult; res2: ProcessExecuteResult }> {
    const proc1 = this.internalLaunch(opt1);
    const proc2 = this.internalLaunch(opt2);

    // Pipe the processes
    // Use pipe() instead of pipeline() to avoid destroying the source streams
    // as they are also being piped to files in launch()
    proc2.child.stdout.pipe(proc1.child.stdin).on('error', () => {});
    proc1.child.stdout.pipe(proc2.child.stdin).on('error', () => {});

    // Wait for both processes to complete
    return new Promise((resolve) => {
      const results: {
        p1?: ProcessExecuteResult;
        p2?: ProcessExecuteResult;
      } = {};

      const checkCompletion = () => {
        this.logger.trace('checkCompletion', {
          results,
        });
        if (results.p1 && results.p2) {
          resolve({
            res1: results.p1,
            res2: results.p2,
          });
        }
      };

      // Handle any process exit or error
      const onSafeClose = async (
        p: 'p1' | 'p2',
        launch: ReturnType<typeof this.internalLaunch>,
        code: number | null,
        signal: NodeJS.Signals | null,
      ) => {
        results[p] ||= await this.collectResult(launch, code ?? signal ?? -1);
        checkCompletion();
      };

      const onSafeError = (
        p: 'p1' | 'p2',
        otherP: 'p1' | 'p2',
        _launch: ReturnType<typeof this.internalLaunch>,
        error: Error,
      ) => {
        if (error.name === 'AbortError') return;
        results[p] ||= this.collectError(error);
        if (!results[otherP]) (p === 'p1' ? proc2 : proc1).child.kill();
        checkCompletion();
      };

      // Process Listeners
      proc1.child.on('close', onSafeClose.bind(null, 'p1', proc1));
      proc2.child.on('close', onSafeClose.bind(null, 'p2', proc2));
      proc1.child.on('error', onSafeError.bind(null, 'p1', 'p2', proc2));
      proc2.child.on('error', onSafeError.bind(null, 'p2', 'p1', proc1));
    });
  }
}

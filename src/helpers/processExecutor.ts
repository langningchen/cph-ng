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

import Logger from '@/helpers/logger';
import { TcIo } from '@/types';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { constants } from 'os';
import { dirname } from 'path';
import { cwd } from 'process';
import { pipeline } from 'stream/promises';
import { l10n } from 'vscode';
import Cache from './cache';
import Settings from './settings';

interface LaunchOptions {
  cmd: string[];
  timeout?: number;
  ac?: AbortController;
  debug?: boolean;
  stdin?: TcIo;
}
interface LaunchResult {
  child: ChildProcessWithoutNullStreams;
  acSignal: AbortSignal;
  stdoutPath: string;
  stderrPath: string;
  startTime: number;
  endTime?: number;
  memory?: number;
  ioPromises: Promise<void>[];
}

export type ExecuteResult =
  | Error
  | {
      // The exit code or signal that terminated the process
      codeOrSignal: number | NodeJS.Signals;
      stdoutPath: string;
      stderrPath: string;
      time: number;
      memory?: number;
      abortReason?: AbortReason;
    };

type RunnerOutput =
  | {
      error: false;
      killed: boolean;
      time: number;
      memory: number;
      exitCode: number;
      signal: number;
    }
  | {
      error: true;
      error_type: number;
      error_code: number;
    };

export enum AbortReason {
  UserAbort = 'user_abort',
  Timeout = 'timeout',
}

export default class ProcessExecutor {
  private static logger: Logger = new Logger('processExecutor');

  private static pipeFailed(pid: number | undefined, name: string) {
    return (e: any) => {
      if (e.code === 'ERR_STREAM_PREMATURE_CLOSE' || e.code === 'EPIPE') {
        this.logger.trace(
          'Pipe',
          name,
          'of process',
          pid,
          'closed prematurely',
        );
      } else {
        this.logger.warn('Set up process', pid, name, 'failed', e);
      }
    };
  }

  public static async executeWithRunner(
    options: LaunchOptions,
    runnerPath: string,
  ): Promise<ExecuteResult> {
    this.logger.trace('executeWithRunner', options);
    if (options.debug) {
      return this.toErrorResult(l10n.t('Debug mode not supported with runner'));
    }
    if (!options.stdin) {
      return this.toErrorResult(
        l10n.t('stdin is required for runner execution'),
      );
    }

    const { cmd, stdin, ac, timeout } = options;
    const unifiedAc = new AbortController();
    if (ac) {
      ac.signal.addEventListener('abort', () =>
        unifiedAc.abort(AbortReason.UserAbort),
      );
    }

    const inputFile = stdin.useFile ? stdin.data : Cache.createIo();
    const stdoutPath = Cache.createIo();
    const stderrPath = Cache.createIo();
    stdin.useFile || (await writeFile(inputFile, stdin.data));

    const runnerCmd = [
      runnerPath,
      cmd.join(' '),
      inputFile,
      stdoutPath,
      stderrPath,
    ];
    if (Settings.runner.unlimitedStack) {
      runnerCmd.push('--unlimited-stack');
    }

    // We use our own timeout handling to allow graceful exit
    const launch = this.launch({
      cmd: runnerCmd,
    });

    const timeoutId = setTimeout(() => {
      this.logger.warn(
        'Soft killing runner',
        launch.child.pid,
        'due to timeout',
        timeout,
      );
      unifiedAc.abort(AbortReason.Timeout);
    }, timeout);
    unifiedAc.signal.addEventListener('abort', () => {
      launch.child.stdin.write('k');
      launch.child.stdin.end();
    });

    return new Promise(async (resolve) => {
      launch.child.on('close', async (code, signal) => {
        stdin.useFile || Cache.dispose(inputFile);
        Cache.dispose([launch.stdoutPath, launch.stderrPath]);
        clearTimeout(timeoutId);
        await Promise.all(launch.ioPromises);
        if (code || signal) {
          Cache.dispose([stdoutPath, stderrPath]);
          resolve(
            this.toErrorResult(
              l10n.t('Runner does not exit properly with code {code}', {
                code: code ?? signal!,
              }),
            ),
          );
          return;
        }
        try {
          this.logger.debug('Reading runner output', launch);
          const runInfo = JSON.parse(
            await readFile(launch.stdoutPath, 'utf-8'),
          ) as RunnerOutput;
          this.logger.info('Runner output', runInfo);
          if (runInfo.error) {
            Cache.dispose([stdoutPath, stderrPath]);
            resolve(
              this.toErrorResult(
                l10n.t('Runner error {type} with code {code}', {
                  type: runInfo.error_type,
                  code: runInfo.error_code,
                }),
              ),
            );
          } else {
            resolve(
              await this.toResult(
                {
                  ...launch,
                  acSignal: unifiedAc.signal,
                  stdoutPath,
                  stderrPath,
                  // Just need to ensure endTime - startTime = time
                  startTime: 0,
                  endTime: runInfo.time,
                  memory: runInfo.memory,
                  ioPromises: [],
                },
                (Object.entries(constants.signals).find(
                  ([, val]) => val === runInfo.signal,
                )?.[0] as NodeJS.Signals) || runInfo.exitCode,
              ),
            );
          }
        } catch (e) {
          this.logger.error('Error parsing runner output', e);
          Cache.dispose([stdoutPath, stderrPath]);
          if (e instanceof SyntaxError) {
            return this.toErrorResult(l10n.t('Runner output is invalid JSON'));
          } else {
            resolve(
              this.toErrorResult(
                l10n.t('Error occurred while processing runner output'),
              ),
            );
          }
        }
      });
      launch.child.on('error', (error) => {
        stdin.useFile || Cache.dispose(inputFile);
        Cache.dispose([
          launch.stdoutPath,
          launch.stderrPath,
          stdoutPath,
          stderrPath,
        ]);
        clearTimeout(timeoutId);
        resolve(this.toErrorResult(error));
      });
    });
  }

  public static async execute(options: LaunchOptions): Promise<ExecuteResult> {
    this.logger.trace('execute', options);
    const launch = this.launch(options);
    return new Promise(async (resolve) => {
      launch.child.on('close', async (code, signal) => {
        resolve(await this.toResult(launch, code ?? signal!));
      });
      launch.child.on('error', (error) => {
        Cache.dispose([launch.stderrPath, launch.stderrPath]);
        error.name === 'AbortError' || resolve(this.toErrorResult(error));
      });
    });
  }

  public static async launchWithPipe(
    process1Options: LaunchOptions,
    process2Options: LaunchOptions,
  ): Promise<{ process1: ExecuteResult; process2: ExecuteResult }> {
    const process1 = this.launch(process1Options);
    const process2 = this.launch(process2Options);

    // Pipe the processes
    // Use pipe() instead of pipeline() to avoid destroying the source streams
    // as they are also being piped to files in launch()
    process2.child.stdout.pipe(process1.child.stdin);
    process1.child.stdout.pipe(process2.child.stdin);
    process1.child.stdin.on('error', () => {});
    process2.child.stdin.on('error', () => {});

    // Wait for both processes to complete
    return new Promise(async (resolve) => {
      const results: {
        process1?: ExecuteResult;
        process2?: ExecuteResult;
      } = {};

      const checkCompletion = () => {
        this.logger.trace('checkCompletion', {
          results,
        });
        if (results.process1 && results.process2) {
          resolve({
            process1: results.process1,
            process2: results.process2,
          });
        }
      };

      // Handle any process exit or error
      // https://nodejs.org/docs/latest/api/child_process.html#event-close
      // "One of the two will always be non-null."
      process1.child.on('close', async (code, signal) => {
        results.process1 ||= await this.toResult(process1, code ?? signal!);
        checkCompletion();
      });
      process2.child.on('close', async (code, signal) => {
        results.process2 ||= await this.toResult(process2, code ?? signal!);
        checkCompletion();
      });
      process1.child.on('error', (error) => {
        if (error.name === 'AbortError') {
          return;
        }
        results.process1 ||= this.toErrorResult(error);
        results.process2 || process2.child.kill();
        checkCompletion();
      });
      process2.child.on('error', (error) => {
        if (error.name === 'AbortError') {
          return;
        }
        results.process2 ||= this.toErrorResult(error);
        results.process1 || process1.child.kill();
        checkCompletion();
      });

      const process1CodeOrSignal =
        process1.child.exitCode ?? process1.child.signalCode;
      if (process1CodeOrSignal !== null) {
        this.logger.debug(
          'Child',
          process1.child.pid,
          'already exited',
          process1CodeOrSignal,
        );
        results.process1 ||= await this.toResult(
          process1,
          process1CodeOrSignal,
        );
      }
      const process2CodeOrSignal =
        process2.child.exitCode ?? process2.child.signalCode;
      if (process2CodeOrSignal !== null) {
        this.logger.debug(
          'Child',
          process2.child.pid,
          'already exited',
          process2CodeOrSignal,
        );
        results.process2 ||= await this.toResult(
          process2,
          process2CodeOrSignal,
        );
      }
    });
  }

  public static launch(options: LaunchOptions): LaunchResult {
    this.logger.trace('createProcess', options);
    const { cmd, ac, timeout, debug, stdin } = options;

    // Use a unified AbortController to handle both external and internal aborts
    const unifiedAc = new AbortController();
    if (ac) {
      ac.signal.addEventListener('abort', () =>
        unifiedAc.abort(AbortReason.UserAbort),
      );
    }

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: cmd[0] ? dirname(cmd[0]) : cwd(),
      signal: unifiedAc.signal,
    });
    this.logger.info('Running executable', options, child.pid);
    const result: LaunchResult = {
      child,
      acSignal: unifiedAc.signal,
      stdoutPath: Cache.createIo(),
      stderrPath: Cache.createIo(),
      startTime: Date.now(),
      ioPromises: [],
    };

    // Send SIGSTOP for debugging
    if (debug) {
      if (!child.kill('SIGSTOP')) {
        this.logger.error('Failed to stop process for debugging', child.pid);
      }
    }

    // Process timeout
    if (timeout) {
      const timeoutId = setTimeout(() => {
        this.logger.warn(`Process ${child.pid} reached timeout ${timeout}ms`);
        unifiedAc.abort(AbortReason.Timeout);
      }, timeout);
      child.on('close', () => clearTimeout(timeoutId));
      child.on('error', () => clearTimeout(timeoutId));
      (child.exitCode ?? child.signalCode) && clearTimeout(timeoutId);
    }

    // Process stdio
    if (stdin) {
      if (stdin.useFile) {
        result.ioPromises.push(
          pipeline(createReadStream(stdin.data), child.stdin).catch(
            ProcessExecutor.pipeFailed(child.pid, 'stdin'),
          ),
        );
      } else {
        child.stdin.write(stdin.data);
        child.stdin.end();
      }
    }
    result.ioPromises.push(
      pipeline(child.stdout, createWriteStream(result.stdoutPath)).catch(
        ProcessExecutor.pipeFailed(child.pid, 'stdout'),
      ),
      pipeline(child.stderr, createWriteStream(result.stderrPath)).catch(
        ProcessExecutor.pipeFailed(child.pid, 'stderr'),
      ),
    );
    return result;
  }

  private static async toResult(
    launch: LaunchResult,
    data: number | NodeJS.Signals,
  ): Promise<ExecuteResult> {
    this.logger.trace('toResult', { launch, data });
    await Promise.all(launch.ioPromises);
    this.logger.debug(`Process ${launch.child.pid} close`, data);
    return {
      codeOrSignal: data,
      stdoutPath: launch.stdoutPath,
      stderrPath: launch.stderrPath,
      // A fallback for time if not set
      time: (launch.endTime ?? Date.now()) - launch.startTime,
      memory: launch.memory,
      abortReason: launch.acSignal.reason as AbortReason | undefined,
    };
  }
  private static toErrorResult(data: Error | string): ExecuteResult {
    this.logger.trace('toErrorResult', { data });
    if (data instanceof Error) {
      return data;
    }
    return new Error(data);
  }
}

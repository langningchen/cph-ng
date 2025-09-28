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

import assert from 'assert';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { SHA256 } from 'crypto-js';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import path, { dirname } from 'path';
import { cwd } from 'process';
import { pipeline } from 'stream/promises';
import * as vscode from 'vscode';
import Logger from '../helpers/logger';
import Settings from '../modules/settings';
import { extensionPath } from '../utils/global';
import Result from '../utils/result';
import { TCIO } from '../utils/types';
import { TCVerdicts } from '../utils/types.backend';

interface ProcessExecutorOptions {
    cmd: string[];
    timeout?: number;
    stdin?: TCIO;
    ac?: AbortController;
}

export interface ProcessResult {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    killed: boolean;
    startTime: number;
    endTime: number;
}

interface ProcessInfo {
    child: ChildProcessWithoutNullStreams;
    stdout: string;
    stderr: string;
    killed: boolean;
    startTime: number;
}

type RunInfo =
    | {
          error: false;
          timeout: boolean;
          time_used: number;
          memory_used: number;
          exit_code: number;
      }
    | {
          error: true;
          error_type: number;
          error_code: number;
      };

export default class ProcessExecutor {
    private static logger: Logger = new Logger('processExecutor');

    private static _runner: string | null = null;
    private static _supported_platform() {
        return ['win32', 'linux'].includes(process.platform);
    }
    public static async loadRunner() {
        ProcessExecutor._runner = path.join(extensionPath, 'res', 'runner.a');
        if (fs.existsSync(ProcessExecutor._runner)) {
            return;
        }
        if (process.platform === 'win32') {
            await ProcessExecutor.execute({
                cmd: [
                    Settings.compilation.cppCompiler,
                    '-lpsapi',
                    '-ladvapi32',
                    '-static',
                    '-o',
                    ProcessExecutor._runner,
                    path.join(extensionPath, 'res', 'runner-windows.cpp'),
                    path.join(extensionPath, 'res', 'runner.h'),
                ],
            });
        } else if (process.platform === 'linux') {
            await ProcessExecutor.execute({
                cmd: [
                    Settings.compilation.cppCompiler,
                    '-pthread',
                    '-o',
                    ProcessExecutor._runner,
                    path.join(extensionPath, 'res', 'runner-linux.cpp'),
                    path.join(extensionPath, 'res', 'runner.h'),
                ],
            });
        }
    }
    public static async executeWithRunner(
        options: ProcessExecutorOptions,
    ): Promise<
        Result<undefined> & {
            time: number;
            memory: number;
            stdout: string;
            stderr: string;
        }
    > {
        this.logger.trace('executeWithRunner', options);

        assert(options.stdin);
        if (!ProcessExecutor._supported_platform()) {
            return {
                verdict: TCVerdicts.SE,
                msg: `runner is unsupported for ${process.platform}`,
                time: 0,
                memory: 0,
                stdout: '',
                stderr: '',
            };
        }
        if (
            !ProcessExecutor._runner ||
            !fs.existsSync(ProcessExecutor._runner)
        ) {
            return {
                verdict: TCVerdicts.SE,
                msg: 'Runner is not compiled',
                time: 0,
                memory: 0,
                stdout: '',
                stderr: '',
            };
        }
        const { cmd, stdin, ac, timeout } = options;

        const hash = SHA256(`${cmd.join(' ')}-${Date.now()}-${Math.random()}`)
            .toString()
            .substring(0, 8);

        const ioDir = path.join(Settings.cache.directory, 'io');
        const outputFile = path.join(ioDir, `${hash}.out`);
        const inputFile = stdin.useFile
            ? stdin.path
            : path.join(ioDir, `${hash}.in`);
        if (!stdin.useFile) {
            fs.writeFileSync(inputFile, stdin.data);
        }
        const proce = await this.createProcess({
            cmd: [
                ProcessExecutor._runner,
                cmd.join(' '),
                inputFile,
                outputFile,
                (timeout || 1e18)?.toString(),
            ],
        });
        const acListener = () => {
            proce.child.stdin.write('abort\n');
            proce.child.stdin.end();
        };
        ac?.signal.addEventListener('abort', acListener);
        return new Promise(async (resolve) => {
            proce.child.on('close', (code, signal) => {
                ac?.signal.removeEventListener('abort', acListener);
                if (ac?.signal.aborted) {
                    resolve({
                        verdict: TCVerdicts.RJ,
                        msg: '',
                        time: 0,
                        memory: 0,
                        stdout: '',
                        stderr: '',
                    });
                    return;
                }
                try {
                    this.logger.info('Runner output:', proce.stdout);
                    const runInfo = JSON.parse(proce.stdout) as RunInfo;
                    if (runInfo.error) {
                        resolve({
                            verdict: TCVerdicts.SE,
                            msg: `Runner error: type=${runInfo.error_type} code=${runInfo.error_code}`,
                            time: 0,
                            memory: 0,
                            stdout: '',
                            stderr: '',
                        });
                        return;
                    }
                    const time_used = runInfo.time_used / 1e4;
                    const memory_used = runInfo.memory_used / 1024.0 / 1024.0;
                    const stdout = fs.readFileSync(outputFile, 'utf8');
                    if (runInfo.timeout) {
                        resolve({
                            verdict: TCVerdicts.TLE,
                            msg: vscode.l10n.t('Killed due to timeout'),
                            time: time_used,
                            memory: memory_used,
                            stdout,
                            stderr: '',
                        });
                    } else if (runInfo.exit_code) {
                        resolve({
                            verdict: TCVerdicts.RE,
                            msg: vscode.l10n.t(
                                'Process exited with code: {code}.',
                                {
                                    code: runInfo.exit_code,
                                },
                            ),
                            time: time_used,
                            memory: memory_used,
                            stdout,
                            stderr: '',
                        });
                    } else {
                        resolve({
                            verdict: TCVerdicts.AC,
                            msg: '',
                            time: time_used,
                            memory: memory_used,
                            stdout,
                            stderr: '',
                        });
                    }
                } catch (error) {
                    resolve({
                        verdict: TCVerdicts.SE,
                        msg: 'Runner output is not valid',
                        time: 0,
                        memory: 0,
                        stdout: '',
                        stderr: '',
                    });
                }
            });
            proce.child.on('error', (error) => {
                ac?.signal.removeEventListener('abort', acListener);
                resolve({
                    ...(ac?.signal.aborted
                        ? { verdict: TCVerdicts.RJ, msg: '' }
                        : {
                              verdict: TCVerdicts.SE,
                              msg: vscode.l10n.t('Process failed to start'),
                          }),
                    time: 0,
                    memory: 0,
                    stdout: '',
                    stderr: '',
                });
            });
        });
    }

    public static async execute(
        options: ProcessExecutorOptions,
    ): Promise<ProcessResult> {
        this.logger.trace('execute', options);
        const process = await this.createProcess(options);
        if (options.stdin) {
            const stdin = process.child.stdin;
            if (options.stdin.useFile) {
                pipeline(createReadStream(options.stdin.path), stdin);
            } else {
                stdin.write(options.stdin.data);
                stdin.end();
            }
        }
        return new Promise(async (resolve) => {
            process.child.on('close', (code, signal) => {
                resolve(this.createResult(process, code, signal));
            });
            process.child.on('error', (error) => {
                resolve(this.createErrorResult(process, error));
            });
        });
    }

    public static async executeWithPipe(
        process1Options: ProcessExecutorOptions,
        process2Options: ProcessExecutorOptions,
    ): Promise<{ process1: ProcessResult; process2: ProcessResult }> {
        const process1 = await this.createProcess(process1Options);
        const process2 = await this.createProcess(process2Options);
        pipeline(process2.child.stdout, process1.child.stdin);
        pipeline(process1.child.stdout, process2.child.stdin);

        return new Promise(async (resolve) => {
            const results: {
                process1?: ProcessResult;
                process2?: ProcessResult;
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
            process1.child.on('close', (code, signal) => {
                results.process1 = this.createResult(process1, code, signal);
                checkCompletion();
            });
            process2.child.on('close', (code, signal) => {
                results.process2 = this.createResult(process2, code, signal);
                checkCompletion();
            });
            process1.child.on('error', (error) => {
                results.process1 = this.createErrorResult(process1, error);
                process2.child.kill();
                checkCompletion();
            });
            process2.child.on('error', (error) => {
                results.process2 = this.createErrorResult(process2, error);
                process1.child.kill();
                checkCompletion();
            });
        });
    }

    private static async createProcess(
        options: ProcessExecutorOptions,
    ): Promise<ProcessInfo> {
        this.logger.trace('createProcess', options);
        const { cmd, ac, timeout } = options;
        const process: ProcessInfo = {
            child: spawn(cmd[0], cmd.slice(1), {
                cwd: cmd[0] ? dirname(cmd[0]) : cwd(),
                signal: ac?.signal,
                killSignal: 'SIGTERM',
            }),
            stdout: '',
            stderr: '',
            killed: false,
            startTime: Date.now(),
        };
        this.logger.info('Running executable', cmd, process.child.pid);
        if (timeout) {
            const timeoutId = setTimeout(() => {
                this.logger.warn(
                    'Killing process',
                    process.child.pid,
                    'due to timeout',
                    timeout,
                );
                process.killed = true;
                process.child.kill('SIGKILL');
            }, timeout);
            process.child.on('close', () => clearTimeout(timeoutId));
            process.child.on('error', () => clearTimeout(timeoutId));
        }
        process.child.stdout.on('data', (data) => {
            process.stdout += data.toString();
        });
        process.child.stderr.on('data', (data) => {
            process.stderr += data.toString();
        });
        return process;
    }

    private static createResult(
        process: ProcessInfo,
        exitCode: number | null,
        signal: NodeJS.Signals | null,
    ): ProcessResult {
        this.logger.trace('createResult', { process, exitCode, signal });
        this.logger.debug('Process close', {
            pid: process.child.pid,
            exitCode,
            signal,
        });
        return {
            exitCode,
            signal,
            ...process,
            endTime: Date.now(),
        } satisfies ProcessResult;
    }

    private static createErrorResult(
        process: ProcessInfo,
        error: Error,
    ): ProcessResult {
        this.logger.trace('createErrorResult', { process, error });
        this.logger.error('Process error', {
            process: process.child.pid,
            error,
        });
        return {
            exitCode: null,
            signal: null,
            stdout: process.stdout,
            stderr: process.stderr + error.message,
            killed: process.killed,
            startTime: process.startTime,
            endTime: Date.now(),
        };
    }
}

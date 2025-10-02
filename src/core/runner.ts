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

import { SHA256 } from 'crypto-js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import * as vscode from 'vscode';
import Logger from '../helpers/logger';
import ProcessExecutor from '../helpers/processExecutor';
import { ProcessResultHandler } from '../helpers/processResultHandler';
import CphNg, { CompileResult } from '../modules/cphNg';
import Settings from '../modules/settings';
import Result, { assignResult } from '../utils/result';
import { Problem, TC, TCIO, TCResult } from '../utils/types';
import { tcIo2Str, TCVerdicts, write2TcIo } from '../utils/types.backend';
import { Checker } from './checker';
import { Lang } from './langs/lang';

type RunnerResult = Result<undefined> & {
    time: number;
    memory: number | undefined;
    stdout: string;
    stderr: string;
};

export class Runner {
    private static logger: Logger = new Logger('runner');

    private static getTCHash(problem: Problem, tc: TC) {
        return SHA256(
            `${problem.src.path}-${
                tc.stdin.useFile ? tc.stdin.path : tc.stdin.data
            }`,
        )
            .toString()
            .substring(64 - 6);
    }

    public static async doRun(
        runCommand: string[],
        timeLimit: number,
        stdin: TCIO,
        abortController: AbortController,
        interactor?: string,
    ): Promise<RunnerResult> {
        this.logger.trace('runExecutable', {
            runCommand,
            timeLimit,
            stdin,
            interactor,
        });

        if (interactor) {
            return this.runWithInteractor(
                runCommand,
                timeLimit,
                stdin,
                abortController,
                interactor,
            );
        } else {
            return this.runWithoutInteractor(
                runCommand,
                timeLimit,
                stdin,
                abortController,
            );
        }
    }

    private static async runWithoutInteractor(
        cmd: string[],
        timeLimit: number,
        stdin: TCIO,
        abortController: AbortController,
    ): Promise<RunnerResult> {
        if (Settings.runner.useRunner && Settings.compilation.useWrapper) {
            return {
                verdict: TCVerdicts.RJ,
                msg: vscode.l10n.t(
                    'Use Runner option cannot be used with Use Wrapper option.',
                ),
                time: 0,
                memory: undefined,
                stdout: '',
                stderr: '',
            };
        }
        return ProcessResultHandler.toRunner(
            Settings.runner.useRunner
                ? await ProcessExecutor.executeWithRunner({
                      cmd,
                      timeout: timeLimit + Settings.runner.timeAddition,
                      stdin,
                      ac: abortController,
                  })
                : await ProcessExecutor.execute({
                      cmd,
                      timeout: timeLimit + Settings.runner.timeAddition,
                      stdin,
                      ac: abortController,
                  }),
            abortController,
        );
    }

    private static async runWithInteractor(
        runCommand: string[],
        timeLimit: number,
        stdin: TCIO,
        ac: AbortController,
        interactor: string,
    ): Promise<RunnerResult> {
        const hash = SHA256(
            `${runCommand.join(' ')}-${Date.now()}-${Math.random()}`,
        )
            .toString()
            .substring(0, 8);

        const ioDir = join(Settings.cache.directory, 'io');
        const inputFile = join(ioDir, `${hash}.in`);
        const outputFile = join(ioDir, `${hash}.out`);

        await writeFile(inputFile, await tcIo2Str(stdin));
        await writeFile(outputFile, '');

        const { process1: solResult, process2: intResult } =
            await ProcessExecutor.executeWithPipe(
                {
                    cmd: runCommand,
                    timeout: timeLimit + Settings.runner.timeAddition,
                    ac: ac,
                },
                {
                    cmd: [interactor, inputFile, outputFile],
                    timeout: timeLimit + Settings.runner.timeAddition,
                    ac: ac,
                },
            );

        this.logger.debug('Interactor execution completed', {
            solResult,
            intResult,
        });

        const intProcessResult = ProcessResultHandler.toChecker(intResult, ac);
        const solProcessResult = ProcessResultHandler.toRunner(solResult, ac);
        return {
            ...(intProcessResult.verdict !== TCVerdicts.UKE
                ? intProcessResult
                : solProcessResult),
            memory: undefined,
            time: solProcessResult.time,
            stdout: await readFile(outputFile, 'utf-8'),
            stderr: solProcessResult.stderr,
        } satisfies RunnerResult;
    }

    public static async run(
        problem: Problem,
        result: TCResult,
        abortController: AbortController,
        lang: Lang,
        tc: TC,
        compileData: NonNullable<CompileResult['data']>,
    ) {
        try {
            result.verdict = TCVerdicts.JG;
            CphNg.emitProblemChange();

            const runResult = await this.doRun(
                await lang.runCommand(compileData.src.outputPath),
                problem.timeLimit,
                tc.stdin,
                abortController,
                compileData.interactor?.outputPath,
            );
            result.time = runResult.time;
            result.memory = runResult.memory;
            result.verdict = TCVerdicts.JGD;
            if (tc.answer.useFile) {
                result.stdout = {
                    useFile: true,
                    path: join(
                        Settings.cache.directory,
                        'out',
                        `${this.getTCHash(problem, tc)}.out`,
                    ),
                };
            } else {
                result.stdout.useFile = false;
            }
            result.stdout = await write2TcIo(result.stdout, runResult.stdout);

            if (
                Settings.runner.stderrThreshold !== -1 &&
                runResult.stderr.length >= Settings.runner.stderrThreshold
            ) {
                result.stderr = {
                    useFile: true,
                    path: join(
                        Settings.cache.directory,
                        'out',
                        `${this.getTCHash(problem, tc)}.err`,
                    ),
                };
            } else {
                result.stderr.useFile = false;
            }
            result.stderr = await write2TcIo(result.stderr, runResult.stderr);
            CphNg.emitProblemChange();

            if (assignResult(result, runResult)) {
            } else if (result.time && result.time > problem.timeLimit) {
                result.verdict = TCVerdicts.TLE;
            } else if (result.memory && result.memory > problem.memoryLimit) {
                result.verdict = TCVerdicts.MLE;
            } else {
                result.verdict = TCVerdicts.CMP;
                CphNg.emitProblemChange();
                assignResult(
                    result,
                    compileData.checker
                        ? await Checker.runChecker(
                              compileData.checker.outputPath,
                              tc,
                              abortController,
                          )
                        : ProcessResultHandler.compareOutputs(
                              runResult.stdout,
                              await tcIo2Str(tc.answer),
                              runResult.stderr,
                          ),
                );
            }
            CphNg.emitProblemChange();
        } catch (e) {
            assignResult(result, {
                verdict: TCVerdicts.SE,
                msg: (e as Error).message,
            });
            CphNg.emitProblemChange();
        }
    }
}

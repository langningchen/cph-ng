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

import * as vscode from 'vscode';
import Logger from '../helpers/logger';
import Settings from '../modules/settings';
import Result from '../utils/result';
import { TCVerdict } from '../utils/types';
import { TCVerdicts } from '../utils/types.backend';
import { ProcessResult } from './processExecutor';

export interface WrapperData {
    time: number;
}

export class ProcessResultHandler {
    private static logger: Logger = new Logger('processResultHandler');

    public static extractWrapperData(stderr: string): {
        wrapperData?: WrapperData;
        cleanStderr: string;
    } {
        const match = stderr.match(/-----CPH DATA STARTS-----(\{.*\})-----/);
        if (match) {
            try {
                const wrapperData = JSON.parse(match[1]) as WrapperData;
                const cleanStderr = stderr.replace(match[0], '').trimEnd();
                return { wrapperData, cleanStderr };
            } catch (e) {
                this.logger.error('Failed to parse wrapper data', e);
            }
        }
        return { cleanStderr: stderr };
    }

    public static toRunner(
        result: ProcessResult,
        abortController?: AbortController,
        ignoreExitCode: boolean = false,
    ): Result<undefined> & {
        time: number;
        memory: number | undefined;
        stdout: string;
        stderr: string;
    } {
        const { wrapperData, cleanStderr } = this.extractWrapperData(
            result.stderr,
        );

        let time = result.endTime - result.startTime;
        if (wrapperData) {
            time = Math.max(wrapperData.time, 1) / 1000.0;
        }

        let verdict: TCVerdict = TCVerdicts.UKE;
        let msg: string = '';

        if (result.killed) {
            verdict = TCVerdicts.TLE;
            msg = vscode.l10n.t('Killed due to timeout');
        } else if (
            !ignoreExitCode &&
            result.exitCode !== null &&
            result.exitCode !== 0
        ) {
            verdict = TCVerdicts.RE;
            msg = vscode.l10n.t('Process exited with code: {code}.', {
                code: result.exitCode,
            });
        } else if (result.signal) {
            verdict = TCVerdicts.RE;
            msg = vscode.l10n.t('Process exited with signal: {signal}.', {
                signal: result.signal,
            });
        } else if (result.errorMsg) {
            verdict = TCVerdicts.SE;
            msg = result.errorMsg;
        } else if (result.exitCode === null) {
            verdict = abortController?.signal.aborted
                ? TCVerdicts.RJ
                : TCVerdicts.SE;
            msg = vscode.l10n.t('Process failed to start');
        }

        return {
            verdict,
            msg,
            time,
            memory: result.memory,
            stdout: result.stdout,
            stderr: cleanStderr,
        };
    }

    public static toChecker(
        result: ProcessResult,
        abortController?: AbortController,
    ): Result<undefined> {
        const preResult = this.toRunner(result, abortController, true);
        if (preResult.verdict !== TCVerdicts.UKE) {
            return preResult;
        }
        const { verdict, msg } = this.getTestlibVerdict(result.exitCode!);
        return {
            verdict,
            msg: `${result.stderr.trim() || result.stdout.trim()}\n${msg || ''}`.trim(),
        };
    }

    private static getTestlibVerdict(code: number): {
        verdict: TCVerdict;
        msg?: string;
    } {
        switch (code) {
            case 0:
                return { verdict: TCVerdicts.AC };
            case 1:
                return { verdict: TCVerdicts.WA };
            case 2:
                return { verdict: TCVerdicts.PE };
            case 3:
                return {
                    verdict: TCVerdicts.SE,
                    msg: vscode.l10n.t('Testlib run failed'),
                };
            case 4:
                return {
                    verdict: TCVerdicts.WA,
                    msg: vscode.l10n.t('Unexpected EOF'),
                };
            case 7:
                return { verdict: TCVerdicts.PC };
            default:
                this.logger.warn('Testlib returned unknown exit code', code);
                return {
                    verdict: TCVerdicts.SE,
                    msg: vscode.l10n.t(
                        'Testlib returned unknown exit code: {code}',
                        { code },
                    ),
                };
        }
    }

    public static compareOutputs(
        stdout: string,
        answer: string,
        stderr: string,
    ): Result<undefined> {
        if (!Settings.comparing.ignoreError && stderr) {
            return { verdict: TCVerdicts.RE, msg: '' };
        }

        const fixedOutput = stdout
            .trimEnd()
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n');
        const fixedAnswer = answer
            .trimEnd()
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n');
        if (
            Settings.comparing.oleSize &&
            fixedOutput.length >=
                fixedAnswer.length * Settings.comparing.oleSize
        ) {
            return { verdict: TCVerdicts.OLE, msg: '' };
        }

        const compressOutput = stdout.replace(/\r|\n|\t|\s/g, '');
        const compressAnswer = answer.replace(/\r|\n|\t|\s/g, '');
        if (compressOutput !== compressAnswer) {
            return { verdict: TCVerdicts.WA, msg: '' };
        }
        if (fixedOutput !== fixedAnswer && !Settings.comparing.regardPEAsAC) {
            return { verdict: TCVerdicts.PE, msg: '' };
        }
        return { verdict: TCVerdicts.AC, msg: '' };
    }
}

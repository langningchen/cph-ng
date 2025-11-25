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
import { TcVerdicts } from '@/types';
import { KnownResult, Result, UnknownResult } from '@/utils/result';
import assert from 'assert';
import { readFile, writeFile } from 'fs/promises';
import { l10n } from 'vscode';
import { AbortReason, ExecuteResult } from './processExecutor';
import Settings from './settings';

export interface WrapperData {
    time: number; // in nanoseconds
}

export type ProcessData = {
    time: number;
    memory?: number;
    stdoutPath: string;
    stderrPath: string;
};

export class ProcessResultHandler {
    private static logger: Logger = new Logger('processResultHandler');

    public static async extractWrapperData(
        stderrPath: string,
    ): Promise<WrapperData | undefined> {
        const stderrContent = await readFile(stderrPath, 'utf-8');
        const wrapperDataRegex = /-----CPH DATA STARTS-----(\{.*?\})-----/s;
        const match = stderrContent.match(wrapperDataRegex);
        if (match) {
            const wrapperDataStr = match[1];
            let wrapperData: WrapperData | undefined;
            try {
                wrapperData = JSON.parse(wrapperDataStr) as WrapperData;
            } catch (e) {
                this.logger.error(
                    'Failed to parse wrapper data JSON',
                    e as Error,
                );
            }
            await writeFile(
                stderrPath,
                stderrContent.replace(wrapperDataRegex, '').trim(),
            );
            return wrapperData;
        } else {
            return undefined;
        }
    }

    public static async parse(
        result: ExecuteResult,
        ignoreExitCode: boolean = false,
    ): Promise<Result<ProcessData>> {
        this.logger.trace('parse', { result, ignoreExitCode });
        this.logger.info('Parsing process result', { result, ignoreExitCode });
        if (result instanceof Error) {
            return new KnownResult(TcVerdicts.SE, result.message);
        }
        const wrapperData = await this.extractWrapperData(result.stderrPath);

        // Use wrapper time if available
        const time = wrapperData
            ? Math.max(wrapperData.time, 1) / 1000.0
            : result.time;
        const processData = {
            time,
            memory: result.memory,
            stdoutPath: result.stdoutPath,
            stderrPath: result.stderrPath,
        };

        if (result.abortReason === AbortReason.Timeout) {
            return new KnownResult(
                TcVerdicts.TLE,
                l10n.t('Killed due to timeout'),
                processData,
            );
        } else if (result.abortReason === AbortReason.UserAbort) {
            return new KnownResult(
                TcVerdicts.RJ,
                l10n.t('Aborted by user'),
                processData,
            );
        } else if (
            // Always handle signal termination
            // Handle exit code only when not ignored
            typeof result.codeOrSignal === 'string' ||
            (!ignoreExitCode && result.codeOrSignal !== 0)
        ) {
            return new KnownResult(
                TcVerdicts.RE,
                l10n.t('Process exited with code: {code}.', {
                    code: result.codeOrSignal,
                }),
                processData,
            );
        }
        return new UnknownResult(processData);
    }

    public static async parseChecker(
        result: ExecuteResult,
    ): Promise<KnownResult<ProcessData>> {
        const preResult = await this.parse(result, true);
        if (preResult instanceof KnownResult) {
            return preResult;
        }

        // We have already handled these two cases in parse
        assert(!(result instanceof Error));
        assert(typeof result.codeOrSignal === 'number');

        return {
            ...this.getTestlibVerdict(result.codeOrSignal),
            data: {
                time: result.time,
                memory: result.memory,
                stdoutPath: result.stdoutPath,
                stderrPath: result.stderrPath,
            },
        };
    }

    private static getTestlibVerdict(code: number): KnownResult {
        switch (code) {
            case 0:
                return new KnownResult(TcVerdicts.AC);
            case 1:
                return new KnownResult(TcVerdicts.WA);
            case 2:
                return new KnownResult(TcVerdicts.PE);
            case 3:
                return new KnownResult(TcVerdicts.SE);
            case 4:
                return new KnownResult(TcVerdicts.WA, l10n.t('Unexpected EOF'));
            case 7:
                return new KnownResult(TcVerdicts.PC);
            default:
                this.logger.warn('Testlib returned unknown exit code', code);
                return new KnownResult(
                    TcVerdicts.SE,
                    l10n.t('Testlib returned unknown exit code: {code}', {
                        code,
                    }),
                );
        }
    }

    public static compareOutputs(
        stdout: string,
        answer: string,
        stderr: string,
    ): KnownResult {
        if (!Settings.comparing.ignoreError && stderr) {
            return new KnownResult(TcVerdicts.RE);
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
            fixedOutput.length > fixedAnswer.length * Settings.comparing.oleSize
        ) {
            return new KnownResult(TcVerdicts.OLE);
        }

        const compressOutput = stdout.replace(/\r|\n|\t|\s/g, '');
        const compressAnswer = answer.replace(/\r|\n|\t|\s/g, '');
        if (compressOutput !== compressAnswer) {
            return new KnownResult(TcVerdicts.WA);
        }
        if (fixedOutput !== fixedAnswer && !Settings.comparing.regardPEAsAC) {
            return new KnownResult(TcVerdicts.PE);
        }
        return new KnownResult(TcVerdicts.AC);
    }
}

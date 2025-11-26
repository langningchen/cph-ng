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

import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import { Problem, Tc, TcIo } from '@/types';
import { version } from '@/utils/packageInfo';
import { enc, MD5 } from 'crypto-js';
import { readdir, readFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { l10n } from 'vscode';

export interface ICphProblem {
    name: string;
    url: string;
    tests: { id: number; input: string; output: string }[];
    interactive: boolean;
    memoryLimit: number;
    timeLimit: number;
    srcPath: string;
    group: string;
    local: boolean;
}

export class CphProblem implements ICphProblem {
    private static logger: Logger = new Logger('CphProblem');

    public name: string;
    public url: string;
    public tests: { id: number; input: string; output: string }[];
    public interactive: boolean;
    public memoryLimit: number;
    public timeLimit: number;
    public srcPath: string;
    public group: string;
    public local: boolean;

    constructor(data: ICphProblem) {
        this.name = data.name;
        this.url = data.url;
        this.tests = data.tests;
        this.interactive = data.interactive;
        this.memoryLimit = data.memoryLimit;
        this.timeLimit = data.timeLimit;
        this.srcPath = data.srcPath;
        this.group = data.group;
        this.local = data.local;
    }

    public static getProbBySrc(srcFile: string): string {
        return join(
            dirname(srcFile),
            '.cph',
            `.${basename(srcFile)}_${MD5(srcFile).toString(enc.Hex)}.prob`,
        );
    }
    public static async fromFile(
        probFile: string,
    ): Promise<CphProblem | undefined> {
        try {
            const data = await readFile(probFile, 'utf-8');
            return new CphProblem(JSON.parse(data) as ICphProblem);
        } catch (e) {
            CphProblem.logger.error('Failed to read CPH problem file', e);
            Io.error(
                l10n.t('Failed to read CPH problem file {file}: {error}', {
                    file: probFile,
                    error: (e as Error).message,
                }),
            );
            return undefined;
        }
    }
    public static async fromFolder(folderUri: string): Promise<CphProblem[]> {
        const problems: CphProblem[] = [];
        const dirEntries = await readdir(folderUri, { withFileTypes: true });
        for (const entry of dirEntries) {
            if (entry.isFile() && entry.name.endsWith('.prob')) {
                const probFilePath = join(folderUri, entry.name);
                const cphProblem = await CphProblem.fromFile(probFilePath);
                if (cphProblem) {
                    problems.push(cphProblem);
                }
            }
        }
        return problems;
    }

    public toProblem(): Problem {
        const problem = Problem.fromI({
            version,
            name: this.name,
            url: this.url,
            tcs: {},
            tcOrder: [],
            timeLimit: this.timeLimit,
            memoryLimit: this.memoryLimit,
            src: { path: this.srcPath },
            timeElapsed: 0,
        });
        for (const test of this.tests) {
            problem.addTc(
                new Tc(
                    new TcIo(false, test.input),
                    new TcIo(false, test.output),
                ),
            );
        }
        return problem;
    }
}

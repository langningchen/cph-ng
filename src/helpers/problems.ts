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

import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname, join, relative } from 'path';
import * as vscode from 'vscode';
import { gunzipSync, gzipSync } from 'zlib';
import { version } from '../../package.json';
import Settings from '../modules/settings';
import {
    EMBEDDED_FOOTER,
    EMBEDDED_HEADER,
    extractEmbedded,
} from '../utils/embedded';
import { migration, OldProblem } from '../utils/migration';
import { renderTemplate } from '../utils/strTemplate';
import { Problem } from '../utils/types';
import Io from './io';
import Logger from './logger';

export default class Problems {
    private static logger: Logger = new Logger('problems');

    public static async getBinByCpp(cppPath: string): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : dirname(cppPath);
        const dir = renderTemplate(Settings.problem.problemFilePath, [
            ['workspace', workspaceFolder],
            ['dirname', dirname(cppPath)],
            ['relativeDirname', relative(workspaceFolder, dirname(cppPath))],
            ['basename', basename(cppPath)],
            ['extname', extname(cppPath)],
            ['basenameNoExt', basename(cppPath, extname(cppPath))],
        ]);
        return dir;
    }

    private static async loadProblemFromBin(
        binFile: string,
    ): Promise<Problem | undefined> {
        try {
            const data = await readFile(binFile);
            try {
                const problem = migration(
                    JSON.parse(
                        gunzipSync(data).toString(),
                    ) satisfies OldProblem,
                );
                Problems.logger.info(
                    'Problem loaded',
                    problem,
                    'from',
                    binFile,
                );
                return problem;
            } catch (e) {
                Io.warn(
                    vscode.l10n.t('Parse problem file {file} failed: {msg}.', {
                        file: basename(binFile),
                        msg: (e as Error).message,
                    }),
                );
            }
        } catch {}
    }
    private static async loadProblemFromEmbedded(
        cppFile: string,
    ): Promise<Problem | undefined> {
        try {
            const cppData = await readFile(cppFile, 'utf-8');
            const embeddedProblem = extractEmbedded(cppData);
            if (!embeddedProblem) {
                const startIdx = cppData.indexOf(EMBEDDED_HEADER);
                const endIdx = cppData.indexOf(EMBEDDED_FOOTER);
                if (startIdx !== -1 || endIdx !== -1) {
                    Io.warn(
                        vscode.l10n.t('Invalid embedded data in {file}.', {
                            file: basename(cppFile),
                        }),
                    );
                }
                return;
            }
            try {
                const problem: Problem = {
                    version,
                    name: embeddedProblem.name,
                    url: embeddedProblem.url,
                    src: { path: cppFile },
                    tcs: embeddedProblem.tcs.map((embeddedTc) => ({
                        stdin: { useFile: false, data: embeddedTc.stdin },
                        answer: { useFile: false, data: embeddedTc.answer },
                        isExpand: false,
                    })),
                    timeLimit: embeddedProblem.timeLimit,
                    timeElapsed: 0,
                };
                if (embeddedProblem.spjCode) {
                    problem.checker = {
                        path: join(
                            dirname(cppFile),
                            basename(cppFile, extname(cppFile)) +
                                '.spj' +
                                extname(cppFile),
                        ),
                    };
                    await writeFile(
                        problem.checker?.path,
                        embeddedProblem.spjCode,
                    );
                }
                if (embeddedProblem.interactorCode) {
                    problem.interactor = {
                        path: join(
                            dirname(cppFile),
                            basename(cppFile, extname(cppFile)) +
                                '.int' +
                                extname(cppFile),
                        ),
                    };
                    await writeFile(
                        problem.interactor?.path,
                        embeddedProblem.interactorCode,
                    );
                }
                return problem;
            } catch (e) {
                Io.warn(
                    vscode.l10n.t(
                        'Parse embedded data in file {file} failed: {msg}.',
                        {
                            file: basename(cppFile),
                            msg: (e as Error).message,
                        },
                    ),
                );
            }
        } catch {}
    }

    public static async loadProblem(
        cppFile: string,
    ): Promise<Problem | undefined> {
        Problems.logger.trace('loadProblem', { cppFile });
        return (
            (await Problems.loadProblemFromBin(
                await Problems.getBinByCpp(cppFile),
            )) || (await Problems.loadProblemFromEmbedded(cppFile))
        );
    }

    public static async saveProblem(problem: Problem): Promise<void> {
        Problems.logger.trace('saveProblem', { problem });
        try {
            const binPath = await Problems.getBinByCpp(problem.src.path);
            Problems.logger.info('Saving problem', problem, 'to', binPath);
            await mkdir(dirname(binPath), { recursive: true });
            await writeFile(
                binPath,
                gzipSync(Buffer.from(JSON.stringify(problem))),
            );
        } catch (e) {
            Io.error(
                vscode.l10n.t('Failed to save problem: {msg}', {
                    msg: (e as Error).message,
                }),
            );
        }
    }
}

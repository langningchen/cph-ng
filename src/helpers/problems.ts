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
import { basename, dirname, extname, relative } from 'path';
import { l10n, Uri, workspace } from 'vscode';
import { gunzipSync, gzipSync } from 'zlib';
import { version } from '../../package.json';
import Settings from '../modules/settings';
import { migration, OldProblem } from '../utils/migration';
import { renderTemplate } from '../utils/strTemplate';
import { Problem, TCIO } from '../utils/types';
import Io from './io';
import Logger from './logger';

export default class Problems {
    private static logger: Logger = new Logger('problems');

    public static async getBinBySrc(srcPath: string): Promise<string | null> {
        const srcUri = Uri.file(srcPath);
        const workspaceFolder = workspace.getWorkspaceFolder(srcUri);
        if (!workspaceFolder) {
            return null;
        }
        const workspacePath = workspaceFolder.uri.fsPath;
        const dir = renderTemplate(Settings.problem.problemFilePath, [
            ['workspace', workspacePath],
            ['dirname', dirname(srcPath)],
            [
                'relativeDirname',
                relative(workspacePath, dirname(srcPath)) || '.',
            ],
            ['basename', basename(srcPath)],
            ['extname', extname(srcPath)],
            ['basenameNoExt', basename(srcPath, extname(srcPath))],
        ]);
        return dir;
    }

    public static createProblem(srcFile: string): Problem {
        return {
            version,
            name: basename(srcFile, extname(srcFile)),
            src: { path: srcFile },
            tcs: {},
            tcOrder: [],
            timeLimit: Settings.problem.defaultTimeLimit,
            memoryLimit: Settings.problem.defaultMemoryLimit,
            enhancedCompare: { enabled: false },
            timeElapsed: 0,
        } satisfies Problem;
    }

    public static async loadProblem(srcFile: string): Promise<Problem | null> {
        this.logger.trace('loadProblem', { srcFile });
        const binPath = await this.getBinBySrc(srcFile);
        if (!binPath) {
            return null;
        }
        try {
            var data = await readFile(binPath);
        } catch {
            return null;
        }
        try {
            var oldProblem = JSON.parse(
                gunzipSync(data).toString(),
            ) satisfies OldProblem;
        } catch (e) {
            Io.warn(
                l10n.t('Parse problem {file} failed: {msg}.', {
                    file: basename(binPath),
                    msg: (e as Error).message,
                }),
            );
            return null;
        }
        try {
            var problem = migration(oldProblem);
        } catch (e) {
            Io.warn(
                l10n.t('Migrate problem {file} failed: {msg}.', {
                    file: basename(binPath),
                    msg: (e as Error).message,
                }),
            );
            return null;
        }
        this.logger.info('Problem loaded', { binPath, problem });
        return problem;
    }

    public static async saveProblem(problem: Problem): Promise<Boolean> {
        this.logger.trace('saveProblem', { problem });
        const binPath = await this.getBinBySrc(problem.src.path);
        if (!binPath) {
            Io.warn(l10n.t('No workspace folder is open.'));
            return false;
        }
        this.logger.info('Saving problem', { binPath, problem });
        try {
            await mkdir(dirname(binPath), { recursive: true });
            await writeFile(
                binPath,
                gzipSync(Buffer.from(JSON.stringify(problem))),
            );
            return true;
        } catch (e) {
            Io.error(
                l10n.t('Failed to save problem: {msg}', {
                    msg: (e as Error).message,
                }),
            );
            return false;
        }
    }

    public static isRelated(problem?: Problem, path?: string): Boolean {
        if (!problem || !path) {
            return false;
        }
        path = path.toLowerCase();
        if (extname(path) in Settings.problem.testCaseExtensionList) {
            return true;
        }
        if (
            path.startsWith(Settings.cache.directory.toLowerCase()) ||
            problem.src.path.toLowerCase() === path ||
            problem.checker?.path.toLowerCase() === path ||
            problem.interactor?.path.toLowerCase() === path ||
            problem.bfCompare?.bruteForce?.path.toLowerCase() === path ||
            problem.bfCompare?.generator?.path.toLowerCase() === path
        ) {
            return true;
        }
        const tcIoRelated = (tcIo?: TCIO) =>
            tcIo && tcIo.useFile && tcIo.path.toLowerCase() === path;
        for (const tc of Object.values(problem.tcs)) {
            if (
                tcIoRelated(tc.stdin) ||
                tcIoRelated(tc.answer) ||
                tcIoRelated(tc.result?.stdout) ||
                tcIoRelated(tc.result?.stderr)
            ) {
                return true;
            }
        }
        return false;
    }
}

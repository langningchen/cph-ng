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

import { access, constants, readFile, unlink } from 'fs/promises';
import { io, Logger } from '../../utils/io';
import Settings from '../../utils/settings';
import { Lang, LangCompileResult } from './lang';
import { basename, dirname, extname, join } from 'path';
import { TCVerdicts } from '../../utils/types.backend';
import * as vscode from 'vscode';
import { SHA256 } from 'crypto-js';
import { FileWithHash } from '../../utils/types';
import { exists } from '../../utils/exec';

export class LangJava extends Lang {
    private logger: Logger = new Logger('langJava');
    public extensions = ['java'];
    public async compile(
        src: FileWithHash,
        ac: AbortController,
        forceCompile?: boolean,
    ): Promise<LangCompileResult> {
        this.logger.trace('compile', { src, forceCompile });

        const classDir = join(Settings.cache.directory, 'bin');
        const className = basename(src.path, extname(src.path));
        const classPath = join(classDir, className + '.class');

        const hash = SHA256(
            (await readFile(src.path)).toString() +
                Settings.compilation.javaCompiler +
                Settings.compilation.javaArgs,
        ).toString();

        if (
            forceCompile === false ||
            (forceCompile !== true &&
                src.hash === hash &&
                (await exists(classPath)))
        ) {
            return {
                verdict: TCVerdicts.UKE,
                msg: '',
                data: { outputPath: classPath, hash },
            };
        }

        try {
            await unlink(classPath);
        } catch {
            this.logger.debug('Output file does not exist, skipping removal', {
                classPath,
            });
        }

        const {
            javaCompiler: compiler,
            javaArgs: args,
            timeout,
        } = Settings.compilation;

        try {
            this.logger.info('Starting compilation', {
                compiler,
                args,
                src: src.path,
                classDir,
            });

            const compilerArgs = args.split(/\s+/).filter(Boolean);

            const result = await Lang.run(
                [compiler, ...compilerArgs, '-d', classDir, src.path],
                src.path,
                ac,
                timeout,
            );

            this.logger.debug('Compilation completed successfully', {
                path: src.path,
                classPath,
            });

            io.compilationMsg = result.stderr.trim();

            return {
                verdict: await access(classPath, constants.R_OK)
                    .then(() => TCVerdicts.UKE)
                    .catch(() => TCVerdicts.CE),
                msg: '',
                data: { outputPath: classPath, hash },
            };
        } catch (e) {
            this.logger.error('Compilation failed', e);
            if (ac.signal.aborted) {
                this.logger.warn('Compilation aborted by user');
                return {
                    verdict: TCVerdicts.RJ,
                    msg: vscode.l10n.t('Compilation aborted by user.'),
                };
            }
            return { verdict: TCVerdicts.CE, msg: (e as Error).message };
        }
    }

    public async runCommand(target: string): Promise<string[]> {
        this.logger.trace('runCommand', { target });
        const classDir = dirname(target);
        const className = basename(target, '.class');
        const { javaRunner: runner, javaRunArgs: runArgs } =
            Settings.compilation;
        const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
        return [runner, ...runArgsArray, '-cp', classDir, className];
    }
}

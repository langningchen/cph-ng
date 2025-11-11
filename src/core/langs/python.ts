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

import { access, constants } from 'fs/promises';
import { basename, extname, join } from 'path';
import { l10n } from 'vscode';
import Io from '../../helpers/io';
import Logger from '../../helpers/logger';
import ProcessExecutor from '../../helpers/processExecutor';
import Settings from '../../modules/settings';
import { FileWithHash } from '../../utils/types';
import { TCVerdicts } from '../../utils/types.backend';
import {
    CompileAdditionalData,
    DefaultCompileAdditionalData,
    Lang,
    LangCompileResult,
} from './lang';

export class LangPython extends Lang {
    private logger: Logger = new Logger('langPython');
    public readonly name = 'Python';
    public readonly extensions = ['py'];
    protected async _compile(
        src: FileWithHash,
        ac: AbortController,
        forceCompile: boolean | null,
        {
            compilationSettings,
        }: CompileAdditionalData = DefaultCompileAdditionalData,
    ): Promise<LangCompileResult> {
        this.logger.trace('compile', { src, forceCompile });

        const cacheDir = join(Settings.cache.directory, 'bin');
        const outputPath = join(
            cacheDir,
            basename(src.path, extname(src.path)) + '.pyc',
        );

        const compiler =
            compilationSettings?.compiler ??
            Settings.compilation.pythonCompiler;
        const args =
            compilationSettings?.compilerArgs ??
            Settings.compilation.pythonArgs;

        const { skip, hash } = await Lang.checkHash(
            src,
            outputPath,
            compiler + args,
            forceCompile,
        );
        if (skip) {
            return {
                verdict: TCVerdicts.UKE,
                msg: '',
                data: { outputPath, hash },
            };
        }

        const { timeout } = Settings.compilation;

        try {
            this.logger.info('Starting compilation', {
                compiler,
                args,
                src: src.path,
                cacheDir,
            });

            const compilerArgs = args.split(/\s+/).filter(Boolean);

            // Compile Python to bytecode using py_compile to the cache directory
            const result = await ProcessExecutor.execute({
                cmd: [
                    compiler,
                    '-c',
                    `import py_compile; py_compile.compile('${src.path}', cfile='${outputPath}', doraise=True)`,
                    ...compilerArgs,
                ],
                ac,
                timeout,
            });

            this.logger.debug('Compilation completed successfully', {
                path: src.path,
                outputPath,
            });
            Io.compilationMsg = result.stderr.trim();
            if (ac.signal.aborted) {
                this.logger.warn('Compilation aborted by user');
                return {
                    verdict: TCVerdicts.RJ,
                    msg: l10n.t('Compilation aborted by user.'),
                };
            }
            if (result.killed) {
                return {
                    verdict: TCVerdicts.CE,
                    msg: l10n.t('Compilation failed because of timeout'),
                };
            }
            if (result.exitCode) {
                return { verdict: TCVerdicts.CE, msg: '' };
            }

            // Check if the compiled .pyc file exists
            return {
                verdict: await access(outputPath, constants.R_OK)
                    .then(() => TCVerdicts.UKE)
                    .catch(() => TCVerdicts.CE),
                msg: '',
                data: { outputPath, hash },
            };
        } catch (e) {
            this.logger.error('Compilation failed', e);
            Io.compilationMsg = (e as Error).message;
            return { verdict: TCVerdicts.CE, msg: '' };
        }
    }

    public async runCommand(
        target: string,
        compilationSettings?: CompileAdditionalData['compilationSettings'],
    ): Promise<string[]> {
        this.logger.trace('runCommand', { target });
        const runner =
            compilationSettings?.runner ?? Settings.compilation.pythonRunner;
        const runArgs =
            compilationSettings?.runnerArgs ??
            Settings.compilation.pythonRunArgs;
        const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
        return [runner, ...runArgsArray, target];
    }
}

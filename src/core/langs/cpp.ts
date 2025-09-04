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
import { type } from 'os';
import { extensionUri } from '../../utils/global';
import { TCVerdicts } from '../../utils/types.backend';
import * as vscode from 'vscode';
import { SHA256 } from 'crypto-js';
import { FileWithHash } from '../../utils/types';
import { execAsync, exists } from '../../utils/exec';

export class LangCpp extends Lang {
    private logger: Logger = new Logger('langCpp');
    public extensions = ['cpp', 'cc', 'cxx', 'c++'];
    public compileHashSuffix(): string {
        return Settings.compilation.cppCompiler + Settings.compilation.cppArgs;
    }
    public async compile(
        src: FileWithHash,
        ac: AbortController,
        forceCompile?: boolean,
    ): Promise<LangCompileResult> {
        this.logger.trace('compile', { src, forceCompile });

        const outputPath = join(
            Settings.cache.directory,
            'bin',
            basename(src.path, extname(src.path)) +
                (type() === 'Windows_NT' ? '.exe' : ''),
        );
        const hash = SHA256(
            (await readFile(src.path)).toString() +
                Settings.compilation.cppCompiler +
                Settings.compilation.cppArgs,
        ).toString();

        if (
            forceCompile === false ||
            (forceCompile !== true &&
                src.hash === hash &&
                (await exists(outputPath)))
        ) {
            return {
                verdict: TCVerdicts.UKE,
                msg: '',
                data: { outputPath, hash },
            };
        }
        try {
            await unlink(outputPath);
        } catch {
            this.logger.debug('Output file does not exist, skipping removal', {
                outputPath,
            });
        }

        const {
            cppCompiler: compiler,
            cppArgs: args,
            objcopy,
            useWrapper,
            useHook,
            timeout,
        } = Settings.compilation;
        try {
            const compileCommands = [];
            const postCommands = [];
            if (useWrapper) {
                const obj = `${outputPath}.o`;
                const wrapperObj = `${outputPath}.wrapper.o`;
                const linkObjects = [obj, wrapperObj];

                compileCommands.push(
                    `${compiler} ${args} "${src.path}" -c -o "${obj}"`,
                    `${compiler} -fPIC -c "${join(extensionUri.fsPath, 'res', 'wrapper.c')}" -o "${wrapperObj}"`,
                );
                if (useHook) {
                    const hookObj = `${outputPath}.hook.o`;
                    linkObjects.push(hookObj);
                    compileCommands.push(
                        `${compiler} -fPIC -Wno-attributes -c "${join(extensionUri.fsPath, 'res', 'hook.c')}" -o "${hookObj}"`,
                    );
                }
                postCommands.push(
                    `${objcopy} --redefine-sym main=original_main "${obj}"`,
                    `${compiler} ${args} ${linkObjects.map((o) => `"${o}"`).join(' ')} -o "${outputPath}"` +
                        (type() === 'Linux' ? ' -ldl' : ''),
                );
            } else {
                compileCommands.push(
                    `${compiler} ${args} "${src.path}" -o "${outputPath}"`,
                );
            }
            this.logger.info('Starting compilation', {
                compileCommands,
                postCommands,
            });
            const results = await Promise.all(
                compileCommands.map((cmd) =>
                    execAsync(cmd, {
                        timeout,
                        cwd: dirname(src.path),
                        signal: ac.signal,
                    }),
                ),
            );
            for (const cmd of postCommands) {
                results.push(
                    await execAsync(cmd, {
                        timeout,
                        cwd: dirname(src.path),
                        signal: ac.signal,
                    }),
                );
            }
            this.logger.debug('Compilation completed successfully', {
                path: src.path,
                outputPath,
            });
            io.compilationMsg = results
                .map((result) => (result.stderr ? result.stderr.trim() : ''))
                .filter((msg) => msg)
                .join('\n\n');
            return {
                verdict: await access(outputPath, constants.X_OK)
                    .then(() => TCVerdicts.UKE)
                    .catch(() => TCVerdicts.CE),
                msg: '',
                data: { outputPath, hash },
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
    public async runCommand(target: string): Promise<string> {
        return target;
    }
}

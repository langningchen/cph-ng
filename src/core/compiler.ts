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

import { exec } from 'child_process';
import { access, constants, unlink } from 'fs/promises';
import { type } from 'os';
import { basename, dirname, extname, join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import Settings from '../utils/settings';
import { Logger } from '../utils/io';
import { extensionUri } from '../utils/global';

const execAsync = promisify(exec);

export class Compiler {
    private logger: Logger = new Logger('compiler');

    public async getExecutablePath(filePath: string): Promise<string> {
        this.logger.trace('getExecutablePath', { filePath });
        try {
            const base = basename(filePath, extname(filePath));
            const executablePath = join(
                Settings.cache.directory,
                'bin',
                base + (type() === 'Windows_NT' ? '.exe' : ''),
            );
            this.logger.debug('Generated executable path', { executablePath });
            return executablePath;
        } catch (e) {
            this.logger.error('Failed to generate executable path', e);
            throw new Error(
                `Failed to generate executable path: ${(e as Error).message}`,
            );
        }
    }

    public async compile(
        filePath: string,
        outputPath: string,
        abortController: AbortController,
        useWrapper: boolean,
    ): Promise<string> {
        this.logger.trace('compile', { filePath, outputPath, useWrapper });
        try {
            await access(outputPath, constants.F_OK);
            this.logger.debug('Output file exists, removing it', {
                outputPath,
            });
            await unlink(outputPath);
        } catch {
            this.logger.debug('Output file does not exist, skipping removal', {
                outputPath,
            });
        }
        const ext = extname(filePath);

        let compileCommands = [''];
        if (ext !== '.cpp' && ext !== '.c') {
            this.logger.warn('Unsupported file type', { type: ext });
            return vscode.l10n.t('Unsupported file type: {type}.', {
                type: ext,
            });
        }
        const wrapperPath = join(extensionUri.fsPath, 'res', 'wrapper.c');
        const hookPath = join(extensionUri.fsPath, 'res', 'hook.c');
        const isCpp = ext === '.cpp';
        const prefix = isCpp
            ? `${Settings.compilation.cppCompiler} ${Settings.compilation.cppArgs}`
            : `${Settings.compilation.cCompiler} ${Settings.compilation.cArgs}`;
        if (useWrapper) {
            const compiler = isCpp
                ? Settings.compilation.cppCompiler
                : Settings.compilation.cCompiler;
            const obj = `${outputPath}.o`;
            const wrapperObj = `${outputPath}.wrapper.o`;
            const linkObjects = [obj, wrapperObj];
            const compileCommands = [
                `${prefix} "${filePath}" -c -o "${obj}"`,
                `${compiler} -fPIC -c "${wrapperPath}" -o "${wrapperObj}"`,
            ];
            if (Settings.compilation.useHook) {
                const hookObj = `${outputPath}.hook.o`;
                linkObjects.push(hookObj);
                compileCommands.push(
                    `${compiler} -fPIC -Wno-attributes -c "${hookPath}" -o "${hookObj}"`,
                );
            }
            const postCommands = [
                `${Settings.compilation.objcopy} --redefine-sym main=original_main "${obj}"`,
                `${prefix} ${linkObjects.map((o) => `"${o}"`).join(' ')} -o "${outputPath}"` +
                    (type() === 'Linux' ? ' -ldl' : ''),
            ];
            this.logger.info('Starting compilation', {
                compileCommands,
                postCommands,
            });
            const results = await Promise.all(
                compileCommands.map((cmd) =>
                    execAsync(cmd, {
                        timeout: Settings.compilation.timeout,
                        cwd: dirname(filePath),
                        signal: abortController.signal,
                    }),
                ),
            );
            for (const cmd of postCommands) {
                results.push(
                    await execAsync(cmd, {
                        timeout: Settings.compilation.timeout,
                        cwd: dirname(filePath),
                        signal: abortController.signal,
                    }),
                );
            }
            this.logger.debug('Compilation completed successfully', {
                filePath,
                outputPath,
            });
            return results
                .map((result) => (result.stderr ? result.stderr.trim() : ''))
                .filter((msg) => msg)
                .join('\n\n');
        }
        try {
            this.logger.info('Starting compilation', { compileCommands });
            const command = `${prefix} "${filePath}" -o "${outputPath}"`;
            this.logger.debug('Executing compile command', { command });
            const { stderr } = await execAsync(command, {
                timeout: Settings.compilation.timeout,
                cwd: dirname(filePath),
                signal: abortController.signal,
            });
            this.logger.debug('Compilation completed successfully', {
                filePath,
                outputPath,
            });
            return stderr;
        } catch (e) {
            this.logger.error('Compilation failed', e);
            return (e as Error).message;
        }
    }
}

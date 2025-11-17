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

import { access, constants, readFile, writeFile } from 'fs/promises';
import { SHA256 } from 'crypto-js';
import { basename, extname, join } from 'path';
import { type } from 'os';
import Logger from '../helpers/logger';
import ProcessExecutor from '../helpers/processExecutor';
import Settings from '../modules/settings';
import { extensionPath } from '../utils/global';

export class FastComparator {
    private static logger: Logger = new Logger('fastComparator');
    private static compiledPath: string | null = null;
    private static compilationPromise: Promise<string | null> | null = null;

    /**
     * Ensures the fast comparator is compiled and returns the path to the executable
     */
    public static async ensureCompiled(): Promise<string | null> {
        // If already compiled, return the path
        if (this.compiledPath) {
            try {
                await access(this.compiledPath, constants.X_OK);
                return this.compiledPath;
            } catch {
                // File no longer exists or is not executable, recompile
                this.compiledPath = null;
            }
        }

        // If already compiling, wait for it
        if (this.compilationPromise) {
            return this.compilationPromise;
        }

        // Start compilation
        this.compilationPromise = this.compile();
        const result = await this.compilationPromise;
        this.compilationPromise = null;
        return result;
    }

    /**
     * Compiles the fast comparator
     */
    private static async compile(): Promise<string | null> {
        try {
            const sourcePath = join(extensionPath, 'res', 'comparator.cpp');
            const outputPath = join(
                Settings.cache.directory,
                'bin',
                'comparator' + (type() === 'Windows_NT' ? '.exe' : ''),
            );

            // Read source to check if we need to recompile
            const sourceContent = await readFile(sourcePath, 'utf-8');
            const sourceHash = SHA256(sourceContent).toString().substring(0, 16);
            const hashFilePath = `${outputPath}.hash`;

            // Check if already compiled with the same source
            try {
                const existingHash = await readFile(hashFilePath, 'utf-8');
                if (existingHash === sourceHash) {
                    await access(outputPath, constants.X_OK);
                    this.logger.info('Fast comparator already compiled, using cached version');
                    this.compiledPath = outputPath;
                    return outputPath;
                }
            } catch {
                // Hash file doesn't exist or binary doesn't exist, need to compile
            }

            this.logger.info('Compiling fast comparator...');

            const compiler = Settings.compilation.cppCompiler;
            const args = Settings.compilation.cppArgs;
            const compilerArgs = args.split(/\s+/).filter(Boolean);

            const cmd = [
                compiler,
                sourcePath,
                ...compilerArgs,
                '-o',
                outputPath,
            ];

            const result = await ProcessExecutor.execute({
                cmd,
                ac: new AbortController(),
                timeout: Settings.compilation.timeout,
            });

            if (result.exitCode !== 0 || result.killed) {
                this.logger.error('Fast comparator compilation failed:', result.stderr);
                return null;
            }

            // Verify the binary is executable
            await access(outputPath, constants.X_OK);

            // Save hash for future checks
            await writeFile(hashFilePath, sourceHash, 'utf-8');

            this.logger.info('Fast comparator compiled successfully');
            this.compiledPath = outputPath;
            return outputPath;
        } catch (e) {
            this.logger.error('Failed to compile fast comparator:', e);
            return null;
        }
    }

    /**
     * Compares two files using the fast comparator
     * @param outputPath Path to the output file
     * @param answerPath Path to the answer file
     * @returns true if files match, false otherwise, null if comparison failed
     */
    public static async compare(
        outputPath: string,
        answerPath: string,
    ): Promise<boolean | null> {
        const comparatorPath = await this.ensureCompiled();
        if (!comparatorPath) {
            this.logger.warn('Fast comparator not available, falling back to standard comparison');
            return null;
        }

        try {
            const result = await ProcessExecutor.execute({
                cmd: [comparatorPath, outputPath, answerPath],
                ac: new AbortController(),
                timeout: 30000, // 30 seconds timeout for comparison
            });

            // Exit code 0 means files match (AC)
            // Exit code 1 means files differ (WA)
            // Any other exit code or error means comparison failed
            if (result.exitCode === 0) {
                return true;
            } else if (result.exitCode === 1) {
                return false;
            } else {
                this.logger.warn('Fast comparator returned unexpected exit code:', result.exitCode);
                return null;
            }
        } catch (e) {
            this.logger.error('Failed to run fast comparator:', e);
            return null;
        }
    }
}

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

import { SHA256 } from 'crypto-js';
import { readFile, unlink } from 'fs/promises';
import { window } from 'vscode';
import Logger from '../../helpers/logger';
import ProcessExecutor from '../../helpers/processExecutor';
import { waitUntil } from '../../utils/global';
import { exists } from '../../utils/process';
import Result from '../../utils/result';
import { FileWithHash } from '../../utils/types';

export type LangCompileResult = Result<{ outputPath: string; hash: string }>;
const logger = new Logger('lang');

export interface CompileAdditionalData {
    canUseWrapper: boolean;
    compilationSettings?: {
        compiler?: string;
        compilerArgs?: string;
        runner?: string;
        runnerArgs?: string;
    };
    debug?: boolean;
}
export const DefaultCompileAdditionalData: CompileAdditionalData = {
    canUseWrapper: false,
};
export class Lang {
    protected static executor: ProcessExecutor = new ProcessExecutor();

    protected static async checkHash(
        src: FileWithHash,
        outputPath: string,
        additionalHash: string,
        forceCompile: boolean | null,
    ) {
        logger.trace('checkHash', {
            src,
            outputPath,
            additionalHash,
            forceCompile,
        });
        const hash = SHA256(
            (await readFile(src.path, 'utf-8')) + additionalHash,
        ).toString();
        if (
            forceCompile === false ||
            (forceCompile !== true &&
                src.hash === hash &&
                (await exists(outputPath)))
        ) {
            logger.debug('Skipping compilation', {
                srcHash: src.hash,
                currentHash: hash,
                outputPath,
            });
            return { skip: true, hash };
        }
        try {
            await unlink(outputPath);
            logger.debug('Removed existing output file', { outputPath });
        } catch {
            logger.debug('No existing output file to remove', { outputPath });
        }
        logger.debug('Proceeding with compilation', {
            srcHash: src.hash,
            currentHash: hash,
            outputPath,
        });
        return { skip: false, hash };
    }
    public readonly name: string = 'generic';
    public readonly extensions: string[] = [];
    public readonly enableRunner: boolean = false;
    public async compile(
        src: FileWithHash,
        ac: AbortController,
        forceCompile: boolean | null,
        additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
    ): Promise<LangCompileResult> {
        const editor = window.visibleTextEditors.find(
            (editor) => editor.document.fileName === src.path,
        );
        if (editor) {
            await editor.document.save();
            await waitUntil(() => !editor.document.isDirty);
        }
        return this._compile(src, ac, forceCompile, additionalData);
    }
    protected async _compile(
        _src: FileWithHash,
        _ac: AbortController,
        _forceCompile: boolean | null,
        _additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
    ): Promise<LangCompileResult> {
        throw new Error('Compile method not implemented.');
    }
    public async runCommand(
        _target: string,
        _compilationSettings?: CompileAdditionalData['compilationSettings'],
    ): Promise<string[]> {
        throw new Error('Run method not implemented.');
    }
}

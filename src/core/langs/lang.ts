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

import { spawn } from 'child_process';
import Result from '../../utils/result';
import { FileWithHash } from '../../utils/types';
import { dirname } from 'path';

export type LangCompileResult = Result<{ outputPath: string; hash: string }>;
export class Lang {
    protected static run(
        cmd: string[],
        srcPath: string,
        ac: AbortController,
        timeout: number,
    ): Promise<{ stdout: string; stderr: string; code: number }> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd[0], cmd.slice(1), {
                cwd: dirname(srcPath),
                signal: ac.signal,
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => (stdout += data.toString()));
            child.stderr.on('data', (data) => (stderr += data.toString()));
            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('Compilation timeout'));
            }, timeout);
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ stdout, stderr, code: code ?? 0 });
            });
            child.on('error', (e: Error) => {
                clearTimeout(timer);
                reject(e);
            });
        });
    }
    public extensions: string[] = [];
    public async compile(
        _src: FileWithHash,
        _ac: AbortController,
        _forceCompile?: boolean,
    ): Promise<LangCompileResult> {
        throw new Error('Compile method not implemented.');
    }
    public async runCommand(_target: string): Promise<string[]> {
        throw new Error('Run method not implemented.');
    }
}

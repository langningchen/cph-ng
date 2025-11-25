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

import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { FileWithHash } from '@/types';
import { UnknownResult } from '@/utils/result';
import { CompileAdditionalData, Lang, LangCompileResult } from './lang';

export class LangJavascript extends Lang {
    private logger: Logger = new Logger('langJavascript');
    public readonly name = 'JavaScript';
    public readonly extensions = ['js'];
    protected async _compile(
        src: FileWithHash,
        _ac: AbortController,
        _forceCompile: boolean | null,
        _compileAdditionalData: CompileAdditionalData,
    ): Promise<LangCompileResult> {
        return new UnknownResult({
            outputPath: src.path,
        });
    }

    public async getRunCommand(
        target: string,
        compilationSettings?: CompileAdditionalData['compilationSettings'],
    ): Promise<string[]> {
        this.logger.trace('runCommand', { target });
        const runner =
            compilationSettings?.runner ??
            Settings.compilation.javascriptRunner;
        const runArgs =
            compilationSettings?.runnerArgs ??
            Settings.compilation.javascriptRunArgs;
        const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
        return [runner, ...runArgsArray, target];
    }
}

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
import { KnownResult, UnknownResult } from '@/utils/result';
import { basename, extname, join } from 'path';
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

    const outputPath = join(
      Settings.cache.directory,
      basename(src.path, extname(src.path)) + '.pyc',
    );

    const compiler =
      compilationSettings?.compiler ?? Settings.compilation.pythonCompiler;
    const args =
      compilationSettings?.compilerArgs ?? Settings.compilation.pythonArgs;

    const { skip, hash } = await Lang.checkHash(
      src,
      outputPath,
      compiler + args,
      forceCompile,
    );
    if (skip) {
      return new UnknownResult({ outputPath, hash });
    }

    const compilerArgs = args.split(/\s+/).filter(Boolean);

    const result = await this._executeCompiler(
      [
        compiler,
        '-c',
        `import py_compile; py_compile.compile(r'${src.path}', cfile=r'${outputPath}', doraise=True)`,
        ...compilerArgs,
      ],
      ac,
    );
    return result instanceof KnownResult
      ? result
      : new UnknownResult({ outputPath, hash });
  }

  public async getRunCommand(
    target: string,
    compilationSettings?: CompileAdditionalData['compilationSettings'],
  ): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner =
      compilationSettings?.runner ?? Settings.compilation.pythonRunner;
    const runArgs =
      compilationSettings?.runnerArgs ?? Settings.compilation.pythonRunArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

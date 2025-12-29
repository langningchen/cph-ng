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

import { createHash } from 'crypto';
import { basename, dirname, extname, join } from 'path';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { FileWithHash } from '@/types';
import { mkdirIfNotExists } from '@/utils/process';
import { KnownResult, UnknownResult } from '@/utils/result';
import {
  CompileAdditionalData,
  DefaultCompileAdditionalData,
  Lang,
  LangCompileResult,
} from './lang';

export class LangJava extends Lang {
  private logger: Logger = new Logger('langsJava');
  public readonly name = 'Java';
  public readonly extensions = ['java'];
  protected async _compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    {
      compilationSettings,
    }: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    this.logger.trace('compile', { src, forceCompile });

    const basenameNoExt = basename(src.path, extname(src.path));
    const pathHash = createHash('sha256')
      .update(src.path)
      .digest('hex')
      .slice(0, 8);
    const outputDir = join(
      Settings.cache.directory,
      `${basenameNoExt}-${pathHash}`,
    );
    const outputPath = join(outputDir, `${basenameNoExt}.class`);

    const compiler =
      compilationSettings?.compiler ?? Settings.compilation.javaCompiler;
    const args =
      compilationSettings?.compilerArgs ?? Settings.compilation.javaArgs;

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

    await mkdirIfNotExists(outputDir);
    const result = await this._executeCompiler(
      [compiler, ...compilerArgs, '-d', outputDir, src.path],
      ac,
    );
    return result instanceof KnownResult
      ? new KnownResult(result.verdict, result.msg, { outputPath, hash })
      : new UnknownResult({ outputPath, hash });
  }

  public async getRunCommand(
    target: string,
    compilationSettings?: CompileAdditionalData['compilationSettings'],
  ): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner =
      compilationSettings?.runner ?? Settings.compilation.javaRunner;
    const runArgs =
      compilationSettings?.runnerArgs ?? Settings.compilation.javaRunArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [
      runner,
      ...runArgsArray,
      '-cp',
      dirname(target),
      basename(target, '.class'),
    ];
  }
}

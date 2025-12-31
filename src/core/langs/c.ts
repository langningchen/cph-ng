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

import { type } from 'os';
import { basename, extname, join } from 'path';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import type { FileWithHash } from '@/types';
import { KnownResult, UnknownResult } from '@/utils/result';
import {
  type CompileAdditionalData,
  DefaultCompileAdditionalData,
  Lang,
  type LangCompileResult,
} from './lang';
import { renderPath } from '@/utils/strTemplate';

export class LangC extends Lang {
  private logger: Logger = new Logger('langsC');
  public readonly name = 'C';
  public readonly extensions = ['c'];
  public readonly enableRunner = true;
  protected async _compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    {
       overwrites,
      debug,
    }: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    this.logger.trace('compile', { src, forceCompile });

    const outputPath = join(
      renderPath(Settings.cache.directory),
      basename(src.path, extname(src.path)) +
        (type() === 'Windows_NT' ? '.exe' : ''),
    );

    const compiler =
      overwrites?.compiler ?? Settings.compilation.cCompiler;
    const args =
      overwrites?.compilerArgs ?? Settings.compilation.cArgs;

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

    const cmd = [compiler, src.path, ...compilerArgs, '-o', outputPath];
    if (Settings.runner.unlimitedStack && type() === 'Windows_NT') {
      cmd.push('-Wl,--stack,268435456');
    }
    debug && cmd.push('-g', '-O0');

    const result = await this._executeCompiler(cmd, ac);
    return result instanceof KnownResult
      ? new KnownResult(result.verdict, result.msg, { outputPath, hash })
      : new UnknownResult({ outputPath, hash });
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

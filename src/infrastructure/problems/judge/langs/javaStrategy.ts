// Copyright (C) 2026 Langning Chen
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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { IFileWithHash, IOverrides } from '@/domain/types';
import { AbstractLanguageStrategy, DefaultCompileAdditionalData } from './abstractLanguageStrategy';

@injectable()
export class LangJava extends AbstractLanguageStrategy {
  public readonly name = 'Java';
  public readonly extensions = ['java'];

  constructor(
    @inject(TOKENS.fileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.logger) protected readonly logger: ILogger,
    @inject(TOKENS.path) protected readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.settings) protected readonly settings: ISettings,
    @inject(TOKENS.translator) protected readonly translator: ITranslator,
    @inject(TOKENS.processExecutor) protected readonly processExecutor: IProcessExecutor,
    @inject(TOKENS.tempStorage) protected readonly tmp: ITempStorage,
  ) {
    super(fs, logger.withScope('langsJava'), settings, translator, processExecutor, tmp);
    this.logger = this.logger.withScope('langsJava');
  }

  protected async internalCompile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileData> {
    this.logger.trace('compile', { src, forceCompile });

    const path = this.path.join(
      this.resolver.renderPath(this.settings.cache.directory),
      `${this.path.basename(src.path, this.path.extname(src.path))}.class`,
    );

    const compiler = additionalData.overrides?.compiler ?? this.settings.compilation.javaCompiler;
    const args = additionalData.overrides?.compilerArgs ?? this.settings.compilation.javaArgs;

    const { skip, hash } = await this.checkHash(src, path, compiler + args, forceCompile);
    if (skip) return { path, hash };

    const compilerArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [
      compiler,
      ...compilerArgs,
      '-d',
      this.resolver.renderPath(this.settings.cache.directory),
      src.path,
    ];
    await this.executeCompiler(cmd, signal);
    return { path, hash };
  }

  public async getRunCommand(target: string, overrides?: IOverrides): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner = overrides?.runner ?? this.settings.compilation.javascriptRunner;
    const runArgs = overrides?.runnerArgs ?? this.settings.compilation.javascriptRunArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

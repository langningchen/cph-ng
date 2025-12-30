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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { CompileAdditionalData } from '@/core/langs/lang';
import type { FileWithHash } from '@/types';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
  type InternalCompileResult,
} from './abstractLanguageStrategy';

@injectable()
export class LangPython extends AbstractLanguageStrategy {
  public readonly name = 'Python';
  public readonly extensions = ['py'];

  constructor(
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Logger) protected readonly logger: ILogger,
    @inject(TOKENS.PathRenderer) private readonly renderer: IPathRenderer,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
  ) {
    super(fs, logger.withScope('langsPython'), settings, translator);
    this.logger = this.logger.withScope('langsPython');
  }

  protected async internalCompile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<InternalCompileResult> {
    this.logger.trace('compile', { src, forceCompile });

    const outputPath = this.fs.join(
      this.renderer.renderPath(this.settings.cache.directory),
      `${this.fs.basename(src.path, this.fs.extname(src.path))}.pyc`,
    );

    const compiler =
      additionalData.compilationSettings?.compiler ??
      this.settings.compilation.pythonCompiler;
    const args =
      additionalData.compilationSettings?.compilerArgs ??
      this.settings.compilation.pythonArgs;

    const { skip, hash } = await this.checkHash(
      src,
      outputPath,
      compiler + args,
      forceCompile,
    );
    if (skip) {
      return { outputPath, hash };
    }

    const compilerArgs = args.split(/\s+/).filter(Boolean);

    const result = await this.executeCompiler(
      [
        compiler,
        '-c',
        `import py_compile; py_compile.compile(r'${src.path}', cfile=r'${outputPath}', doraise=True)`,
        ...compilerArgs,
      ],
      ac,
    );
    if (result instanceof Error) return result;
    return { outputPath, hash };
  }

  public async getRunCommand(
    target: string,
    compilationSettings?: CompileAdditionalData['compilationSettings'],
  ): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner =
      compilationSettings?.runner ?? this.settings.compilation.pythonRunner;
    const runArgs =
      compilationSettings?.runnerArgs ??
      this.settings.compilation.pythonRunArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

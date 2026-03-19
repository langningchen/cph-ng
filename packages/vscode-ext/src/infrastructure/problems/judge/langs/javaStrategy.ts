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

import type { IFileWithHash, IOverrides } from '@cph-ng/core';
import type { IPath } from '@v/application/ports/node/IPath';
import type {
  CompileAdditionalData,
  ILanguageDefaultValues,
  LangCompileData,
} from '@v/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@v/application/ports/services/IPathResolver';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import { TOKENS } from '@v/composition/tokens';
import { LanguageStrategyContext } from '@v/infrastructure/problems/judge/langs/languageStrategyContext';
import { inject, injectable } from 'tsyringe';
import { AbstractLanguageStrategy, DefaultCompileAdditionalData } from './abstractLanguageStrategy';

@injectable()
export class LangJava extends AbstractLanguageStrategy {
  public override readonly name = 'Java';
  public override readonly extensions = ['java'];
  public override readonly defaultValues;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
  ) {
    super({ ...context, logger: logger.withScope('langsJava') });
    this.defaultValues = {
      compiler: this.settings.languages.javaCompiler,
      compilerArgs: this.settings.languages.javaCompilerArgs,
      runner: this.settings.languages.javaRunner,
      runnerArgs: this.settings.languages.javaRunnerArgs,
    } satisfies ILanguageDefaultValues;
    this.settings.languages.onChangeJavaCompiler(
      (compiler) => (this.defaultValues.compiler = compiler),
    );
    this.settings.languages.onChangeJavaCompilerArgs(
      (args) => (this.defaultValues.compilerArgs = args),
    );
    this.settings.languages.onChangeJavaRunner((runner) => (this.defaultValues.runner = runner));
    this.settings.languages.onChangeJavaRunnerArgs(
      (args) => (this.defaultValues.runnerArgs = args),
    );
  }

  protected override async internalCompile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileData> {
    const path = this.path.join(
      this.resolver.renderPath(this.settings.cache.directory),
      `${this.path.basename(src.path, this.path.extname(src.path))}.class`,
    );

    const compiler = additionalData.overrides?.compiler || this.defaultValues.compiler;
    const args = additionalData.overrides?.compilerArgs || this.defaultValues.compilerArgs;

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

  public override async getRunCommand(target: string, overrides?: IOverrides): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner = overrides?.runner || this.defaultValues.runner;
    const runArgs = overrides?.runnerArgs || this.defaultValues.runnerArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

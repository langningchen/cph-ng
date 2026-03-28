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
import { inject, injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';
import type {
  CompileAdditionalData,
  ILanguageDefaultValues,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LanguageStrategyContext } from '@/infrastructure/problems/judge/langs/languageStrategyContext';
import { AbstractLanguageStrategy, DefaultCompileAdditionalData } from './abstractLanguageStrategy';

@injectable()
export class LangPython extends AbstractLanguageStrategy {
  public override readonly name = 'Python';
  public override readonly extensions = ['py'];
  public override readonly defaultValues;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
  ) {
    super({ ...context, logger: logger.withScope('langsPython') });
    this.defaultValues = {
      compiler: this.settings.languages.pythonCompiler,
      compilerArgs: this.settings.languages.pythonCompilerArgs,
      runner: this.settings.languages.pythonRunner,
      runnerArgs: this.settings.languages.pythonRunnerArgs,
    } satisfies ILanguageDefaultValues;
    this.settings.languages.onChangePythonCompiler(
      (compiler) => (this.defaultValues.compiler = compiler),
    );
    this.settings.languages.onChangePythonCompilerArgs(
      (args) => (this.defaultValues.compilerArgs = args),
    );
    this.settings.languages.onChangePythonRunner((runner) => (this.defaultValues.runner = runner));
    this.settings.languages.onChangePythonRunnerArgs(
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
      `${this.path.basename(src.path, this.path.extname(src.path))}.pyc`,
    );

    const compiler = additionalData.overrides?.compiler || this.defaultValues.compiler;
    const args = additionalData.overrides?.compilerArgs || this.defaultValues.compilerArgs;

    const { skip, hash } = await this.checkHash(src, path, compiler + args, forceCompile);
    if (skip) {
      return { path, hash };
    }

    const compilerArgs = args.split(/\s+/).filter(Boolean);

    await this.executeCompiler(
      [
        compiler,
        ...compilerArgs,
        '-c',
        `import py_compile; py_compile.compile(r'${src.path}', cfile=r'${path}', doraise=True)`,
      ],
      signal,
    );
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

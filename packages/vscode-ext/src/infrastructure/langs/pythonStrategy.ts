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

import type { IFileWithHash, ILanguageEnv, IOverrides } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LanguageStrategyContext } from '@/infrastructure/langs/languageStrategyContext';
import { AbstractLanguageStrategy, DefaultCompileAdditionalData } from './abstractLanguageStrategy';

@injectable()
export class LangPython extends AbstractLanguageStrategy {
  public override readonly name = 'Python';
  public override readonly extensions = ['py'];
  public override readonly defaultValues;
  public override readonly compilerQuery = {
    filePatterns: ['python*', 'pypy*'],
    groupPatterns: [
      {
        group: 'Python',
        helpRegex:
          /^usage: .*python.* \[option\] \.\.\. \[-c cmd \| -m mod \| file \| -\] \[arg\] \.\.\.$/m,
        versionRegex: /^Python (?<version>[0-9]+\.[0-9]+\.[0-9]+)$/m,
      },
      {
        group: 'PyPy',
        helpRegex: /^Other environment variables:$/m,
        versionRegex: /^Python (?<version>[0-9]+\.[0-9]+\.[0-9]+) \((?<description>.+)\)$/m,
      },
    ],
  };
  public override readonly interpreterQuery = this.compilerQuery;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
  ) {
    super({ ...context, logger: logger.withScope('langsPython') });
    this.defaultValues = {
      compiler: this.settings.languages.pythonCompiler,
      compilerArgs: this.settings.languages.pythonCompilerArgs,
      interpreter: this.settings.languages.pythonInterpreter,
      interpreterArgs: this.settings.languages.pythonInterpreterArgs,
    } satisfies ILanguageEnv;
    this.settings.languages.onChangePythonCompiler(
      (compiler) => (this.defaultValues.compiler = compiler),
    );
    this.settings.languages.onChangePythonCompilerArgs(
      (args) => (this.defaultValues.compilerArgs = args),
    );
    this.settings.languages.onChangePythonInterpreter(
      (interpreter) => (this.defaultValues.interpreter = interpreter),
    );
    this.settings.languages.onChangePythonInterpreterArgs(
      (args) => (this.defaultValues.interpreterArgs = args),
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

  public override async getInterpretCommand(
    target: string,
    overrides?: IOverrides,
  ): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const interpreter = overrides?.interpreter || this.defaultValues.interpreter;
    const args = overrides?.interpreterArgs || this.defaultValues.interpreterArgs;
    const argsArray = args.split(/\s+/).filter(Boolean);
    return [interpreter, ...argsArray, target];
  }
}

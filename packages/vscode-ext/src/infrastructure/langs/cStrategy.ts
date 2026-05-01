import type { IFileWithHash, ILanguageEnv } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ISystem } from '@/application/ports/node/ISystem';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/langs/abstractLanguageStrategy';
import { LanguageStrategyContext } from '@/infrastructure/langs/languageStrategyContext';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public override readonly name = 'C';
  public override readonly extensions = ['c'];
  public override readonly enableExternalRunner = true;
  public override readonly defaultValues;
  public override readonly compilerQuery = {
    filePatterns: ['gcc*', '*-gcc*', 'clang*', '*clang-*'],
    groupPatterns: [
      {
        group: 'gcc',
        helpRegex: /^For bug reporting instructions, please see:$/m,
        versionRegex: /^(?<name>.*) \((?<description>.+)\) (?<version>[0-9]+\.[0-9]+\.[0-9]+)$/m,
      },
      {
        group: 'clang',
        helpRegex: /^OVERVIEW: clang LLVM compiler$/m,
        versionRegex:
          /^(?<name>.*) version (?<version>[0-9]+\.[0-9]+\.[0-9]+) \((?<description>.+)\)$/m,
      },
    ],
  };

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.system) private readonly sys: ISystem,
  ) {
    super({ ...context, logger: logger.withScope('langsC') });
    this.defaultValues = {
      compiler: this.settings.languages.cCompiler,
      compilerArgs: this.settings.languages.cCompilerArgs,
    } satisfies ILanguageEnv;
    this.settings.languages.onChangeCCompiler(
      (compiler) => (this.defaultValues.compiler = compiler),
    );
    this.settings.languages.onChangeCCompilerArgs(
      (args) => (this.defaultValues.compilerArgs = args),
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
      this.path.basename(src.path, this.path.extname(src.path)) +
        (this.sys.platform() === 'win32' ? '.exe' : ''),
    );

    const compiler = additionalData.overrides?.compiler || this.defaultValues.compiler;
    const args = additionalData.overrides?.compilerArgs || this.defaultValues.compilerArgs;
    const { unlimitedStack } = this.settings.run;

    const { skip, hash } = await this.checkHash(
      src,
      path,
      compiler + args + unlimitedStack,
      forceCompile,
    );
    if (skip) return { path, hash };

    const compilerArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
    if (unlimitedStack && this.sys.platform() === 'win32') cmd.push('-Wl,--stack,268435456');
    await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
}

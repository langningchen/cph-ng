import { inject, injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type {
  CompileAdditionalData,
  ILanguageDefaultValues,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import type { IFileWithHash } from '@/domain/types';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/problems/judge/langs/abstractLanguageStrategy';
import { LanguageStrategyContext } from '@/infrastructure/problems/judge/langs/languageStrategyContext';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public override readonly name = 'C';
  public override readonly extensions = ['c'];
  public override readonly enableRunner = true;
  public override readonly defaultValues;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.system) private readonly sys: ISystem,
  ) {
    super({ ...context, logger: logger.withScope('langsC') });
    this.defaultValues = {
      compiler: this.settings.compilation.cCompiler,
      compilerArgs: this.settings.compilation.cArgs,
    } satisfies ILanguageDefaultValues;
  }

  protected override async internalCompile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileData> {
    this.logger.trace('compile', { src, forceCompile });

    const path = this.path.join(
      this.resolver.renderPath(this.settings.cache.directory),
      this.path.basename(src.path, this.path.extname(src.path)) +
        (this.sys.platform() === 'win32' ? '.exe' : ''),
    );

    const compiler = additionalData.overrides?.compiler ?? this.defaultValues.compiler;
    const args = additionalData.overrides?.compilerArgs ?? this.defaultValues.compilerArgs;

    const { skip, hash } = await this.checkHash(src, path, compiler + args, forceCompile);
    if (skip) return { path, hash };

    const compilerArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
    if (this.settings.runner.unlimitedStack && this.sys.platform() === 'win32')
      cmd.push('-Wl,--stack,2147483647');
    await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
}

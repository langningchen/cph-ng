import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ISystem } from '@/application/ports/node/ISystem';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/problems/judge/langs/abstractLanguageStrategy';
import type { FileWithHash } from '@/types';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public readonly name = 'C';
  public readonly extensions = ['c'];
  public readonly enableRunner = true;

  constructor(
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Logger) protected readonly logger: ILogger,
    @inject(TOKENS.PathRenderer) private readonly renderer: IPathRenderer,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.System) private readonly system: ISystem,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
  ) {
    super(fs, logger.withScope('langsC'), settings, translator);
    this.logger = this.logger.withScope('langsC');
  }

  protected async internalCompile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileData> {
    this.logger.trace('compile', { src, forceCompile });

    const path = this.fs.join(
      this.renderer.renderPath(this.settings.cache.directory),
      this.fs.basename(src.path, this.fs.extname(src.path)) +
        (this.system.type() === 'Windows_NT' ? '.exe' : ''),
    );

    const compiler = additionalData.overrides?.compiler ?? this.settings.compilation.cCompiler;
    const args = additionalData.overrides?.compilerArgs ?? this.settings.compilation.cArgs;

    const { skip, hash } = await this.checkHash(src, path, compiler + args, forceCompile);
    if (skip) return { path, hash };

    const compilerArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
    if (this.settings.runner.unlimitedStack && this.system.type() === 'Windows_NT')
      cmd.push('-Wl,--stack,268435456');
    await this.executeCompiler(cmd, ac);
    return { path, hash };
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

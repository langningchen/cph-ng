import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { FileWithHash } from '@/domain/entities/fileWithHash';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/problems/judge/langs/abstractLanguageStrategy';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public readonly name = 'C';
  public readonly extensions = ['c'];
  public readonly enableRunner = true;

  constructor(
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Path) protected readonly path: IPath,
    @inject(TOKENS.Logger) protected readonly logger: ILogger,
    @inject(TOKENS.PathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.System) private readonly sys: ISystem,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
  ) {
    super(fs, logger.withScope('langsC'), settings, translator);
    this.logger = this.logger.withScope('langsC');
  }

  protected async internalCompile(
    src: FileWithHash,
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

    const compiler = additionalData.overrides?.compiler ?? this.settings.compilation.cCompiler;
    const args = additionalData.overrides?.compilerArgs ?? this.settings.compilation.cArgs;

    const { skip, hash } = await this.checkHash(src, path, compiler + args, forceCompile);
    if (skip) return { path, hash };

    const compilerArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
    if (this.settings.runner.unlimitedStack && this.sys.platform() === 'win32')
      cmd.push('-Wl,--stack,268435456');
    await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

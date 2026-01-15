import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  CompileAdditionalData,
  ILanguageDefaultValues,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { IFileWithHash } from '@/domain/types';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/problems/judge/langs/abstractLanguageStrategy';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public override readonly name = 'C';
  public override readonly extensions = ['c'];
  public override readonly enableRunner = true;
  public override readonly defaultValues;

  constructor(
    @inject(TOKENS.fileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.logger) protected readonly logger: ILogger,
    @inject(TOKENS.path) protected readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.processExecutor) protected readonly processExecutor: IProcessExecutor,
    @inject(TOKENS.settings) protected readonly settings: ISettings,
    @inject(TOKENS.system) private readonly sys: ISystem,
    @inject(TOKENS.translator) protected readonly translator: ITranslator,
    @inject(TOKENS.tempStorage) protected readonly tmp: ITempStorage,
    @inject(TOKENS.telemetry) protected readonly telemetry: ITelemetry,
  ) {
    super(fs, logger.withScope('langsC'), settings, translator, processExecutor, tmp, telemetry);
    this.logger = this.logger.withScope('langsC');
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
      cmd.push('-Wl,--stack,268435456');
    await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
}

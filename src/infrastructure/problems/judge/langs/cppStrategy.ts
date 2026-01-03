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
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@/infrastructure/problems/judge/langs/abstractLanguageStrategy';
import type { FileWithHash } from '@/types';

@injectable()
export class LangCpp extends AbstractLanguageStrategy {
  public readonly name = 'C++';
  public readonly extensions = ['cpp', 'cc', 'cxx', 'c++'];
  public readonly enableRunner = true;

  constructor(
    @inject(TOKENS.ExtensionPath) private readonly extPath: string,
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Logger) protected readonly logger: ILogger,
    @inject(TOKENS.Path) protected readonly path: IPath,
    @inject(TOKENS.PathRenderer) private readonly resolver: IPathResolver,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.System) private readonly sys: ISystem,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
  ) {
    super(fs, logger.withScope('langsCpp'), settings, translator);
    this.logger = this.logger.withScope('langsCpp');
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

    const compiler = additionalData.overrides?.compiler ?? this.settings.compilation.cppCompiler;
    const args = additionalData.overrides?.compilerArgs ?? this.settings.compilation.cppArgs;
    const { objcopy, useWrapper, useHook } = this.settings.compilation;

    const { skip, hash } = await this.checkHash(
      src,
      path,
      compiler + args + useWrapper + useHook,
      forceCompile,
    );
    if (skip) return { path, hash };

    const compileCommands: string[][] = [];
    const postCommands: string[][] = [];
    const compilerArgs = args.split(/\s+/).filter(Boolean);
    if (additionalData.canUseWrapper && useWrapper) {
      const linkObjs = [];

      const solSrc = src.path;
      const solObj = `${path}.o`;
      compileCommands.push([compiler, solSrc, ...compilerArgs, '-c', '-o', solObj]);
      linkObjs.push(solObj);

      const wrapperSrc = this.path.join(this.extPath, 'res', 'wrapper.cpp');
      const wrapperObj = `${path}.wrapper.o`;
      compileCommands.push([compiler, '-fPIC', '-c', wrapperSrc, '-o', wrapperObj]);
      linkObjs.push(wrapperObj);

      if (useHook) {
        const hookSrc = this.path.join(this.extPath, 'res', 'hook.cpp');
        const hookObj = `${path}.hook.o`;
        compileCommands.push([compiler, '-fPIC', '-c', hookSrc, '-o', hookObj]);
        linkObjs.push(hookObj);
      }

      const linkCmd = [compiler, ...linkObjs, ...compilerArgs, '-o', path];
      if (this.sys.platform() === 'linux') linkCmd.push('-ldl');
      postCommands.push([objcopy, '--redefine-sym', 'main=original_main', solObj], linkCmd);
    } else {
      const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
      if (this.settings.runner.unlimitedStack && this.sys.platform() === 'win32')
        cmd.push('-Wl,--stack,268435456');
      compileCommands.push(cmd);
    }

    await Promise.all(compileCommands.map((cmd) => this.executeCompiler(cmd, signal)));
    for (const cmd of postCommands) await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

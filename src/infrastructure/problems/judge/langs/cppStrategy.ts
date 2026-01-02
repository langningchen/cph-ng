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
export class LangCpp extends AbstractLanguageStrategy {
  public readonly name = 'C++';
  public readonly extensions = ['cpp', 'cc', 'cxx', 'c++'];
  public readonly enableRunner = true;

  constructor(
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Logger) protected readonly logger: ILogger,
    @inject(TOKENS.PathRenderer) private readonly renderer: IPathRenderer,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.System) private readonly system: ISystem,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
    @inject(TOKENS.ExtensionPath) private readonly path: string,
  ) {
    super(fs, logger.withScope('langsCpp'), settings, translator);
    this.logger = this.logger.withScope('langsCpp');
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

      const wrapperSrc = this.fs.join(this.path, 'res', 'wrapper.cpp');
      const wrapperObj = `${path}.wrapper.o`;
      compileCommands.push([compiler, '-fPIC', '-c', wrapperSrc, '-o', wrapperObj]);
      linkObjs.push(wrapperObj);

      if (useHook) {
        const hookSrc = this.fs.join(this.path, 'res', 'hook.cpp');
        const hookObj = `${path}.hook.o`;
        compileCommands.push([compiler, '-fPIC', '-c', hookSrc, '-o', hookObj]);
        linkObjs.push(hookObj);
      }

      const linkCmd = [compiler, ...linkObjs, ...compilerArgs, '-o', path];
      if (this.system.type() === 'Linux') linkCmd.push('-ldl');
      postCommands.push([objcopy, '--redefine-sym', 'main=original_main', solObj], linkCmd);
    } else {
      const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
      if (this.settings.runner.unlimitedStack && this.system.type() === 'Windows_NT')
        cmd.push('-Wl,--stack,268435456');
      compileCommands.push(cmd);
    }

    await Promise.all(compileCommands.map((cmd) => this.executeCompiler(cmd, ac)));
    for (const cmd of postCommands) await this.executeCompiler(cmd, ac);
    return { path, hash };
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

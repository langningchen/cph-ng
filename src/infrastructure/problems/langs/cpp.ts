import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { CompileAdditionalData } from '@/application/ports/problems/ILanguageStrategy';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
  type InternalCompileResult,
} from '@/infrastructure/problems/langs/abstractLanguageStrategy';
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
  ): Promise<InternalCompileResult> {
    this.logger.trace('compile', { src, forceCompile });

    const outputPath = this.fs.join(
      this.renderer.renderPath(this.settings.cache.directory),
      this.fs.basename(src.path, this.fs.extname(src.path)) +
        (this.system.type() === 'Windows_NT' ? '.exe' : ''),
    );

    const compiler =
      additionalData.compilationSettings?.compiler ??
      this.settings.compilation.cppCompiler;
    const args =
      additionalData.compilationSettings?.compilerArgs ??
      this.settings.compilation.cppArgs;

    const { skip, hash } = await this.checkHash(
      src,
      outputPath,
      compiler +
        args +
        this.settings.compilation.useWrapper +
        this.settings.compilation.useHook,
      forceCompile,
    );
    if (skip) return { outputPath, hash };

    const { objcopy, useWrapper, useHook } = this.settings.compilation;
    const compileCommands: string[][] = [];
    const postCommands: string[][] = [];
    const compilerArgs = args.split(/\s+/).filter(Boolean);
    if (additionalData.canUseWrapper && useWrapper) {
      const obj = `${outputPath}.o`;
      const wrapperObj = `${outputPath}.wrapper.o`;
      const linkObjects = [obj, wrapperObj];

      compileCommands.push(
        [compiler, src.path, ...compilerArgs, '-c', '-o', obj],
        [
          compiler,
          '-fPIC',
          '-c',
          this.fs.join(this.path, 'res', 'wrapper.cpp'),
          '-o',
          wrapperObj,
        ],
      );
      if (useHook) {
        const hookObj = `${outputPath}.hook.o`;
        linkObjects.push(hookObj);
        compileCommands.push([
          compiler,
          '-fPIC',
          '-Wno-attributes',
          '-c',
          this.fs.join(this.path, 'res', 'hook.cpp'),
          '-o',
          hookObj,
        ]);
      }
      postCommands.push(
        [objcopy, '--redefine-sym', 'main=original_main', obj],
        [
          compiler,
          ...linkObjects,
          ...compilerArgs,
          '-o',
          outputPath,
          ...(this.system.type() === 'Linux' ? ['-ldl'] : []),
        ],
      );
    } else {
      const cmd = [compiler, src.path, ...compilerArgs, '-o', outputPath];
      if (
        this.settings.runner.unlimitedStack &&
        this.system.type() === 'Windows_NT'
      ) {
        cmd.push('-Wl,--stack,268435456');
      }
      compileCommands.push(cmd);
    }

    for (const result of await Promise.all(
      compileCommands.map((cmd) => this.executeCompiler(cmd, ac)),
    )) {
      if (result instanceof Error) return result;
    }
    for (const cmd of postCommands) {
      const result = await this.executeCompiler(cmd, ac);
      if (result instanceof Error) return result;
    }
    return { outputPath, hash };
  }
  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}

import type { IFileWithHash } from '@cph-ng/core';
import type { IPath } from '@v/application/ports/node/IPath';
import type { ISystem } from '@v/application/ports/node/ISystem';
import type {
  CompileAdditionalData,
  ILanguageDefaultValues,
  LangCompileData,
} from '@v/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IPathResolver } from '@v/application/ports/services/IPathResolver';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import { TOKENS } from '@v/composition/tokens';
import {
  AbstractLanguageStrategy,
  DefaultCompileAdditionalData,
} from '@v/infrastructure/problems/judge/langs/abstractLanguageStrategy';
import { LanguageStrategyContext } from '@v/infrastructure/problems/judge/langs/languageStrategyContext';
import { inject, injectable } from 'tsyringe';

@injectable()
export class LangCpp extends AbstractLanguageStrategy {
  public override readonly name = 'C++';
  public override readonly extensions = ['cpp', 'cc', 'cxx', 'c++'];
  public override readonly enableRunner = true;
  public override readonly defaultValues;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.logger) logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.system) private readonly sys: ISystem,
  ) {
    super({ ...context, logger: logger.withScope('langsCpp') });
    this.defaultValues = {
      compiler: this.settings.languages.cppCompiler,
      compilerArgs: this.settings.languages.cppCompilerArgs,
    } satisfies ILanguageDefaultValues;
    this.settings.languages.onChangeCppCompiler(
      (compiler) => (this.defaultValues.compiler = compiler),
    );
    this.settings.languages.onChangeCppCompilerArgs(
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
    const { cppObjcopy } = this.settings.languages;
    const { useWrapper, useHook, unlimitedStack } = this.settings.run;

    const { skip, hash } = await this.checkHash(
      src,
      path,
      compiler + args + useWrapper + useHook + unlimitedStack,
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
      if (unlimitedStack && this.sys.platform() === 'win32') linkCmd.push('-Wl,--stack,268435456');
      postCommands.push([cppObjcopy, '--redefine-sym', 'main=original_main', solObj], linkCmd);
    } else {
      const cmd = [compiler, src.path, ...compilerArgs, '-o', path];
      if (unlimitedStack && this.sys.platform() === 'win32') cmd.push('-Wl,--stack,268435456');
      compileCommands.push(cmd);
    }

    await Promise.all(compileCommands.map((cmd) => this.executeCompiler(cmd, signal)));
    for (const cmd of postCommands) await this.executeCompiler(cmd, signal);
    return { path, hash };
  }
}

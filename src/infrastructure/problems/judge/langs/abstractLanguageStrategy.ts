import { SHA256 } from 'crypto-js';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { AbortReason, type IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import {
  type CompileAdditionalData,
  CompileError,
  CompileRejected,
  type ILanguageDefaultValues,
  type ILanguageStrategy,
  type LangCompileData,
  type LangCompileResult,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IFileWithHash, IOverrides } from '@/domain/types';
import { CompilationIo } from '@/helpers/io';
import { telemetry } from '@/utils/global';

export const DefaultCompileAdditionalData: CompileAdditionalData = {
  canUseWrapper: false,
};

export abstract class AbstractLanguageStrategy implements ILanguageStrategy {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];
  public readonly enableRunner: boolean = false;
  public abstract readonly defaultValues: ILanguageDefaultValues;

  constructor(
    protected readonly fs: IFileSystem,
    protected readonly logger: ILogger,
    protected readonly settings: ISettings,
    protected readonly translator: ITranslator,
    protected readonly processExecutor: IProcessExecutor,
    protected readonly tmp: ITempStorage,
  ) {}

  public async compile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    // Clear previous compilation IO
    CompilationIo.clear();

    try {
      const compileEnd = telemetry.start('compile', {
        lang: this.name,
        forceCompile: forceCompile ? 'auto' : String(forceCompile),
      });
      const result = await this.internalCompile(src, signal, forceCompile, additionalData);
      compileEnd({ ...result });

      if (!(await this.fs.exists(result.path)))
        return new CompileError(this.translator.t('Compilation output does not exist'));
      return result;
    } catch (e) {
      this.logger.error('Compilation failed', e);
      CompilationIo.append((e as Error).message);
      telemetry.error('compileError', e);
      return e as Error;
    }
  }

  protected async internalCompile(
    src: IFileWithHash,
    _signal: AbortSignal,
    _forceCompile: boolean | null,
    _additionalData: CompileAdditionalData,
  ): Promise<LangCompileData> {
    return { path: src.path };
  }

  protected async executeCompiler(cmd: string[], signal: AbortSignal): Promise<void> {
    const result = await this.processExecutor.execute({
      cmd,
      signal,
      timeoutMs: this.settings.compilation.timeout,
    });
    if (result instanceof Error) throw result;
    if (result.abortReason === AbortReason.UserAbort)
      throw new CompileRejected(this.translator.t('Compilation aborted by user'));
    if (result.abortReason === AbortReason.Timeout)
      throw new CompileError(this.translator.t('Compilation timed out'));
    CompilationIo.append(await this.fs.readFile(result.stdoutPath));
    CompilationIo.append(await this.fs.readFile(result.stderrPath));
    if (result.codeOrSignal)
      throw new CompileError(this.translator.t('Compilation failed with non-zero exit code'));
    this.tmp.dispose([result.stdoutPath, result.stderrPath]);
  }

  protected async checkHash(
    src: IFileWithHash,
    outputPath: string,
    additionalHash: string,
    forceCompile: boolean | null,
  ): Promise<{
    skip: boolean;
    hash: string;
  }> {
    this.logger.trace('Checking hash for file', src, {
      src,
      outputPath,
      additionalHash,
      forceCompile,
    });
    const hash = SHA256((await this.fs.readFile(src.path)) + additionalHash).toString();
    const outputExists = await this.fs.exists(outputPath);
    if (outputExists && (forceCompile === false || (forceCompile !== true && src.hash === hash))) {
      this.logger.debug('Skipping compilation', {
        srcHash: src.hash,
        currentHash: hash,
        outputPath,
      });
      return { skip: true, hash };
    }
    if (outputExists) await this.fs.rm(outputPath);
    this.logger.debug('Proceeding with compilation', {
      srcHash: src.hash,
      currentHash: hash,
      outputPath,
    });
    return { skip: false, hash };
  }

  public async getRunCommand(target: string, _compilationSettings?: IOverrides): Promise<string[]> {
    return [target];
  }
}

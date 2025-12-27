import { SHA256 } from 'crypto-js';
import { window } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type {
  CompileAdditionalData,
  ILanguageStrategy,
  LangCompileResult,
} from '@/application/ports/problems/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import Cache from '@/helpers/cache';
import { CompilationIo } from '@/helpers/io';
import ProcessExecutor, { AbortReason } from '@/helpers/processExecutor';
import type { FileWithHash, ICompilationSettings } from '@/types';
import { telemetry, waitUntil } from '@/utils/global';

export const DefaultCompileAdditionalData: CompileAdditionalData = {
  canUseWrapper: false,
};

export interface CompilerExecuteData {
  isAborted?: boolean;
  isTimeout?: boolean;
  compilerFailed?: boolean;
}
export type CompilerExecuteResult = CompilerExecuteData | Error;

export interface InternalCompileData {
  outputPath?: string;
  hash?: string;
}
export type InternalCompileResult = InternalCompileData | Error;

export abstract class AbstractLanguageStrategy implements ILanguageStrategy {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];
  public readonly enableRunner: boolean = false;

  constructor(
    protected readonly fs: IFileSystem,
    protected readonly logger: ILogger,
    protected readonly settings: ISettings,
    protected readonly translator: ITranslator,
  ) {}

  public async compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    // Save the file if it's opened in an editor
    const editor = window.visibleTextEditors.find(
      (editor) => editor.document.fileName === src.path,
    );
    if (editor) {
      await editor.document.save();
      await waitUntil(() => !editor.document.isDirty);
    }

    // Clear previous compilation IO
    CompilationIo.clear();

    const result: LangCompileResult = {
      outputExists: false,
      internalError: false,
    };
    try {
      const compileEnd = telemetry.start('compile', {
        lang: this.name,
        forceCompile: forceCompile ? 'auto' : String(forceCompile),
      });
      const langCompileResult = await this._compile(
        src,
        ac,
        forceCompile,
        additionalData,
      );
      if (langCompileResult instanceof Error) {
        return {
          outputExists: false,
          internalError: true,
        };
      }
      compileEnd({ ...langCompileResult });

      result.outputPath = langCompileResult.outputPath;
      result.hash = langCompileResult.hash;
    } catch (e) {
      this.logger.error('Compilation failed', e);
      CompilationIo.append((e as Error).message);
      telemetry.error('compileError', e);
      result.internalError = true;
    }
    result.outputExists =
      !!result.outputPath && (await this.fs.exists(result.outputPath));
    return result;
  }

  protected abstract _compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData,
  ): Promise<InternalCompileResult>;

  protected async _executeCompiler(
    cmd: string[],
    ac: AbortController,
  ): Promise<CompilerExecuteResult> {
    const result = await ProcessExecutor.execute({
      cmd,
      ac,
      timeout: this.settings.compilation.timeout,
    });
    if (result instanceof Error) {
      return result;
    }
    if (result.abortReason === AbortReason.UserAbort) {
      return {
        isAborted: true,
      };
    }
    if (result.abortReason === AbortReason.Timeout) {
      return {
        isTimeout: true,
      };
    }
    CompilationIo.append(await this.fs.readFile(result.stdoutPath));
    CompilationIo.append(await this.fs.readFile(result.stderrPath));
    if (result.codeOrSignal) {
      return {
        compilerFailed: true,
      };
    }
    Cache.dispose([result.stdoutPath, result.stderrPath]);
    return {
      isAborted: false,
      isTimeout: false,
    };
  }

  protected async checkHash(
    src: FileWithHash,
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
    const hash = SHA256(
      (await this.fs.readFile(src.path)) + additionalHash,
    ).toString();
    if (
      forceCompile === false ||
      (forceCompile !== true &&
        src.hash === hash &&
        (await this.fs.exists(outputPath)))
    ) {
      this.logger.debug('Skipping compilation', {
        srcHash: src.hash,
        currentHash: hash,
        outputPath,
      });
      return { skip: true, hash };
    }
    try {
      await this.fs.rm(outputPath);
      this.logger.debug('Removed existing output file', { outputPath });
    } catch {
      this.logger.debug('No existing output file to remove', { outputPath });
    }
    this.logger.debug('Proceeding with compilation', {
      srcHash: src.hash,
      currentHash: hash,
      outputPath,
    });
    return { skip: false, hash };
  }

  public abstract getRunCommand(
    target: string,
    compilationSettings?: ICompilationSettings,
  ): Promise<string[]>;
}

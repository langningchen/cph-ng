// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { SHA256 } from 'crypto-js';
import type { OutputChannel } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { AbortReason, type IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import {
  CompileAborted,
  type CompileAdditionalData,
  CompileError,
  type ILanguageDefaultValues,
  type ILanguageStrategy,
  type LangCompileData,
  type LangCompileResult,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IFileWithHash, IOverrides } from '@/domain/types';
import type { LanguageStrategyContext } from '@/infrastructure/problems/judge/langs/languageStrategyContext';

export const DefaultCompileAdditionalData: CompileAdditionalData = {
  canUseWrapper: false,
};

export abstract class AbstractLanguageStrategy implements ILanguageStrategy {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];
  public readonly enableRunner: boolean = false;
  public abstract readonly defaultValues: ILanguageDefaultValues;

  protected readonly fs: IFileSystem;
  protected readonly logger: ILogger;
  protected readonly settings: ISettings;
  protected readonly translator: ITranslator;
  protected readonly processExecutor: IProcessExecutor;
  protected readonly tmp: ITempStorage;
  protected readonly telemetry: ITelemetry;
  protected readonly compilation: OutputChannel;

  public constructor(context: LanguageStrategyContext) {
    this.fs = context.fs;
    this.logger = context.logger;
    this.settings = context.settings;
    this.translator = context.translator;
    this.processExecutor = context.processExecutor;
    this.tmp = context.tmp;
    this.telemetry = context.telemetry;
    this.compilation = context.compilation;
  }

  public async compile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    // Clear previous compilation IO
    this.compilation.clear();

    try {
      const compileEnd = this.telemetry.start('compile', {
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
      this.compilation.append((e as Error).message);
      this.telemetry.error('compileError', e);
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
      throw new CompileAborted(this.translator.t('Compilation aborted by user'));
    if (result.abortReason === AbortReason.Timeout)
      throw new CompileError(this.translator.t('Compilation timed out'));
    this.compilation.append(await this.fs.readFile(result.stdoutPath));
    this.compilation.append(await this.fs.readFile(result.stderrPath));
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

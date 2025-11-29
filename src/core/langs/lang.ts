// Copyright (C) 2025 Langning Chen
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

import { checkHash } from '@/core/compiler/cache';
import Cache from '@/helpers/cache';
import { CompilationIo } from '@/helpers/io';
import Logger from '@/helpers/logger';
import ProcessExecutor, { AbortReason } from '@/helpers/processExecutor';
import Settings from '@/helpers/settings';
import { FileWithHash, ICompilationSettings, TcVerdicts } from '@/types';
import { telemetry, waitUntil } from '@/utils/global';
import { KnownResult, Result, UnknownResult } from '@/utils/result';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { l10n, window } from 'vscode';

export interface LangCompileData {
  outputPath: string;
  hash?: string;
}
export type LangCompileResult = Result<LangCompileData>;
const logger = new Logger('lang');

export interface CompileAdditionalData {
  canUseWrapper: boolean;
  compilationSettings?: ICompilationSettings;
  debug?: boolean;
}
export const DefaultCompileAdditionalData: CompileAdditionalData = {
  canUseWrapper: false,
};

export class Lang {
  protected static executor: ProcessExecutor = new ProcessExecutor();

  protected static async checkHash(
    src: FileWithHash,
    outputPath: string,
    additionalHash: string,
    forceCompile: boolean | null,
  ): Promise<{
    skip: boolean;
    hash: string;
  }> {
    return checkHash(src, outputPath, additionalHash, forceCompile);
  }

  public readonly name: string = 'generic';
  public readonly extensions: string[] = [];
  public readonly enableRunner: boolean = false;

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
      // We have to wait until the document is actually saved to disk.
      // Although `editor.document.save()` returns a promise, it seems that
      // the promise resolves before the file is fully written.
      // See https://github.com/langningchen/cph-ng/issues/60
      await waitUntil(() => !editor.document.isDirty);
    }

    // Clear previous compilation IO
    CompilationIo.clear();

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
      compileEnd(langCompileResult.flatten());

      // Check if the output file exists
      if (
        langCompileResult instanceof UnknownResult &&
        !existsSync(langCompileResult.data.outputPath)
      ) {
        return new KnownResult(TcVerdicts.CE, l10n.t('Compilation failed'));
      }
      return langCompileResult;
    } catch (e) {
      logger.error('Compilation failed', e);
      CompilationIo.append((e as Error).message);
      telemetry.error('compileError', {
        error: (e as Error).message,
      });
      return new KnownResult(TcVerdicts.CE, l10n.t('Compilation failed'));
    }
  }
  protected async _compile(
    _src: FileWithHash,
    _ac: AbortController,
    _forceCompile: boolean | null,
    _additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    throw new Error('Compile method not implemented.');
  }
  protected async _executeCompiler(
    cmd: string[],
    ac: AbortController,
  ): Promise<Result<undefined>> {
    const result = await ProcessExecutor.execute({
      cmd,
      ac,
      timeout: Settings.compilation.timeout,
    });
    if (result instanceof Error) {
      return new KnownResult(TcVerdicts.SE, result.message);
    }
    if (result.abortReason === AbortReason.UserAbort) {
      return new KnownResult(
        TcVerdicts.RJ,
        l10n.t('Compilation aborted by user'),
      );
    }
    if (result.abortReason === AbortReason.Timeout) {
      return new KnownResult(TcVerdicts.CE, l10n.t('Compilation timed out'));
    }
    CompilationIo.append(await readFile(result.stdoutPath, 'utf-8'));
    CompilationIo.append(await readFile(result.stderrPath, 'utf-8'));
    if (result.codeOrSignal) {
      return new KnownResult(
        TcVerdicts.CE,
        l10n.t('Compiler exited with code {code}', {
          code: result.codeOrSignal,
        }),
      );
    }
    Cache.dispose([result.stdoutPath, result.stderrPath]);
    return new UnknownResult(undefined);
  }

  public async getRunCommand(
    _target: string,
    _compilationSettings?: ICompilationSettings,
  ): Promise<string[]> {
    throw new Error('Run method not implemented.');
  }
}

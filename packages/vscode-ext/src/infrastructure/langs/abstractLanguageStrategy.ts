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

import type {
  IFileWithHash,
  ILanguageDefaultValues,
  IOverrides,
  ToolchainItem,
} from '@cph-ng/core';
import SHA256 from 'crypto-js/sha256';
import pathKey from 'path-key';
import type { OutputChannel } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import { AbortReason, type IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import {
  CompileAborted,
  type CompileAdditionalData,
  CompileError,
  type ILanguageStrategy,
  type LangCompileData,
  type LangCompileResult,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { LanguageStrategyContext } from '@/infrastructure/langs/languageStrategyContext';

export type GroupPattern = { group: string; helpRegex: RegExp; versionRegex: RegExp };
export interface ToolchainQuery {
  filePatterns: string[];
  groupPatterns: GroupPattern[];
}

export const DefaultCompileAdditionalData: CompileAdditionalData = {
  canUseWrapper: false,
};

export abstract class AbstractLanguageStrategy implements ILanguageStrategy {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];
  public readonly enableExternalRunner: boolean = false;
  public abstract readonly defaultValues: ILanguageDefaultValues;
  protected readonly compilerQuery?: ToolchainQuery;
  protected readonly interpreterQuery?: ToolchainQuery;

  protected readonly compilation: OutputChannel;
  protected readonly fs: IFileSystem;
  protected readonly logger: ILogger;
  protected readonly path: IPath;
  protected readonly processExecutor: IProcessExecutor;
  protected readonly settings: ISettings;
  protected readonly telemetry: ITelemetry;
  protected readonly tmp: ITempStorage;
  protected readonly translator: ITranslator;

  public constructor(context: LanguageStrategyContext) {
    this.compilation = context.compilation;
    this.fs = context.fs;
    this.logger = context.logger;
    this.path = context.path;
    this.processExecutor = context.processExecutor;
    this.settings = context.settings;
    this.telemetry = context.telemetry;
    this.tmp = context.tmp;
    this.translator = context.translator;
  }

  public async checkCompiler(path: string): Promise<ToolchainItem | null> {
    if (!this.compilerQuery) return null;
    return this.checkExecutable(path, this.compilerQuery.groupPatterns);
  }
  public async getCompilers(): Promise<ToolchainItem[]> {
    if (!this.compilerQuery) return [];
    return this.getExecutablesInPath(
      this.compilerQuery.filePatterns,
      this.compilerQuery.groupPatterns,
    );
  }
  public async checkInterpreter(_path: string): Promise<ToolchainItem | null> {
    if (!this.interpreterQuery) return null;
    return this.checkExecutable(_path, this.interpreterQuery.groupPatterns);
  }
  public async getInterpreters(): Promise<ToolchainItem[]> {
    if (!this.interpreterQuery) return [];
    return this.getExecutablesInPath(
      this.interpreterQuery.filePatterns,
      this.interpreterQuery.groupPatterns,
    );
  }

  protected async checkExecutable(
    path: string,
    groupPatterns: GroupPattern[],
  ): Promise<ToolchainItem | null> {
    const helpResult = await this.processExecutor.execute({ cmd: [path, '--help'] });
    if (helpResult instanceof Error) return null;
    const helpString = await this.fs.readFile(helpResult.stdoutPath);
    this.tmp.dispose([helpResult.stdoutPath, helpResult.stderrPath]);
    for (const { group, helpRegex, versionRegex } of groupPatterns) {
      if (helpRegex.test(helpString)) {
        const versionResult = await this.processExecutor.execute({ cmd: [path, '--version'] });
        if (versionResult instanceof Error) return null;
        const versionString = await this.fs.readFile(versionResult.stdoutPath);
        this.tmp.dispose([versionResult.stdoutPath, versionResult.stderrPath]);
        const versionMatch = versionString.match(versionRegex);
        if (!versionMatch?.groups) return null;
        const { name, version, description } = versionMatch.groups;
        return {
          name: name || this.path.basename(path),
          group,
          version,
          description,
          path,
        } satisfies ToolchainItem;
      }
    }
    return null;
  }
  protected async getExecutablesInPath(
    filePatterns: string[],
    groupPatterns: GroupPattern[],
  ): Promise<ToolchainItem[]> {
    const envPath = process.env[pathKey()] || '';
    const directories = envPath.split(this.path.delimiter);
    const found: string[] = [];
    const promises: Promise<ToolchainItem | null>[] = [];
    for (const pattern of filePatterns) {
      for (const dir of directories) {
        try {
          const matches = this.path.glob(this.path.join(dir, pattern));
          for await (const path of matches) {
            const stat = await this.fs.stat(path);
            if (stat.isFile() && stat.mode & 0o111 && !found.includes(path)) {
              found.push(path);
              promises.push(this.checkExecutable(path, groupPatterns));
            }
          }
        } catch {}
      }
    }
    return (await Promise.all(promises)).filter((v) => !!v);
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
      const result = await this.internalCompile(src, signal, forceCompile, additionalData);
      if (!(await this.fs.exists(result.path)))
        return new CompileError(this.translator.t('Compilation output does not exist'));
      return result;
    } catch (e) {
      this.logger.error('Compilation failed', e);
      this.compilation.append((e as Error).message);
      this.compilation.show(true);
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
    return { path: src.path, hash: null };
  }

  protected async executeCompiler(cmd: string[], signal: AbortSignal): Promise<void> {
    const result = await this.processExecutor.execute({
      cmd,
      signal,
      timeoutMs: this.settings.run.compilationTimeout,
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

  public async getInterpretCommand(
    target: string,
    _compilationSettings?: IOverrides,
  ): Promise<string[]> {
    return [target];
  }
}

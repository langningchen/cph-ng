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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  CompileAdditionalData,
  LangCompileData,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { IFileWithHash, IOverrides } from '@/domain/types';
import { AbstractLanguageStrategy, DefaultCompileAdditionalData } from './abstractLanguageStrategy';

@injectable()
export class LangJavascript extends AbstractLanguageStrategy {
  public readonly name = 'JavaScript';
  public readonly extensions = ['js'];

  constructor(
    @inject(TOKENS.fileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.logger) protected readonly logger: ILogger,
    @inject(TOKENS.settings) protected readonly settings: ISettings,
    @inject(TOKENS.translator) protected readonly translator: ITranslator,
    @inject(TOKENS.processExecutor) protected readonly processExecutor: IProcessExecutor,
    @inject(TOKENS.tempStorage) protected readonly tmp: ITempStorage,
  ) {
    super(fs, logger.withScope('langsJavascript'), settings, translator, processExecutor, tmp);
    this.logger = this.logger.withScope('langsJavascript');
  }

  protected async internalCompile(
    src: IFileWithHash,
    _signal: AbortSignal,
    _forceCompile: boolean | null,
    _additionalData: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileData> {
    return { path: src.path };
  }

  public async getRunCommand(target: string, overrides?: IOverrides): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner = overrides?.runner ?? this.settings.compilation.javascriptRunner;
    const runArgs = overrides?.runnerArgs ?? this.settings.compilation.javascriptRunArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

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

import type { IFileSystem } from '@v/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@v/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@v/application/ports/node/ITempStorage';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ISettings } from '@v/application/ports/vscode/ISettings';
import type { ITelemetry } from '@v/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import { TOKENS } from '@v/composition/tokens';
import { inject, injectable } from 'tsyringe';
import type { OutputChannel } from 'vscode';

@injectable()
export class LanguageStrategyContext {
  public constructor(
    @inject(TOKENS.fileSystem) public readonly fs: IFileSystem,
    @inject(TOKENS.logger) public readonly logger: ILogger,
    @inject(TOKENS.settings) public readonly settings: ISettings,
    @inject(TOKENS.translator) public readonly translator: ITranslator,
    @inject(TOKENS.processExecutor) public readonly processExecutor: IProcessExecutor,
    @inject(TOKENS.tempStorage) public readonly tmp: ITempStorage,
    @inject(TOKENS.telemetry) public readonly telemetry: ITelemetry,
    @inject(TOKENS.compilationOutputChannel) public readonly compilation: OutputChannel,
  ) {}
}

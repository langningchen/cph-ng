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
import type { ILanguageDefaultValues } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import type { IOverrides } from '@/domain/types';
import { LanguageStrategyContext } from '@/infrastructure/problems/judge/langs/languageStrategyContext';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangJavascript extends AbstractLanguageStrategy {
  public override readonly name = 'JavaScript';
  public override readonly extensions = ['js'];
  public override readonly defaultValues;

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
  ) {
    super({ ...context, logger: logger.withScope('langsJavascript') });
    this.defaultValues = {
      runner: this.settings.compilation.javascriptRunner,
      runnerArgs: this.settings.compilation.javascriptRunArgs,
    } satisfies ILanguageDefaultValues;
  }

  public override async getRunCommand(target: string, overrides?: IOverrides): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner = overrides?.runner ?? this.defaultValues.runner;
    const runArgs = overrides?.runnerArgs ?? this.defaultValues.runnerArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

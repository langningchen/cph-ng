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

import type { ILanguageEnv, IOverrides } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LanguageStrategyContext } from '@/infrastructure/langs/languageStrategyContext';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangJavascript extends AbstractLanguageStrategy {
  public override readonly name = 'JavaScript';
  public override readonly extensions = ['js'];
  public override readonly defaultValues;
  public override readonly interpreterQuery = {
    filePatterns: ['node', 'node.exe', 'bun', 'bun.exe', 'deno', 'deno.exe'],
    groupPatterns: [
      {
        group: 'Node',
        helpRegex: /^Documentation can be found at/m,
        versionRegex: /^v(?<version>[0-9]+\.[0-9]+\.[0-9]+)/m,
      },
      {
        group: 'Bun',
        helpRegex: /^Learn more about Bun:/m,
        versionRegex: /^(?<version>[0-9]+\.[0-9]+\.[0-9]+)/m,
      },
      {
        group: 'Deno',
        helpRegex: /^Deno: A modern JavaScript and TypeScript runtime$/m,
        versionRegex:
          /^(?<name>[a-z]+) (?<version>[0-9]+\.[0-9]+\.[0-9]+) \((?<description>.+)\)$/m,
      },
    ],
  };

  public constructor(
    @inject(LanguageStrategyContext) context: LanguageStrategyContext,
    @inject(TOKENS.logger) logger: ILogger,
  ) {
    super({ ...context, logger: logger.withScope('langsJavascript') });
    this.defaultValues = {
      interpreter: this.settings.languages.javascriptInterpreter,
      interpreterArgs: this.settings.languages.javascriptInterpreterArgs,
    } satisfies ILanguageEnv;
    this.settings.languages.onChangeJavascriptInterpreter(
      (interpreter) => (this.defaultValues.interpreter = interpreter),
    );
    this.settings.languages.onChangeJavascriptInterpreterArgs(
      (args) => (this.defaultValues.interpreterArgs = args),
    );
  }

  public override async getInterpretCommand(
    target: string,
    overrides?: IOverrides,
  ): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    const runner = overrides?.interpreter || this.defaultValues.interpreter;
    const runArgs = overrides?.interpreterArgs || this.defaultValues.interpreterArgs;
    const runArgsArray = runArgs.split(/\s+/).filter(Boolean);
    return [runner, ...runArgsArray, target];
  }
}

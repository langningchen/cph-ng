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

import type { UpdateSettingsMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class UpdateSettings implements IMsgHandle<UpdateSettingsMsg> {
  public constructor(
    @inject(TOKENS.languageRegistry) private readonly languageRegistry: ILanguageRegistry,
  ) {}

  public async exec(msg: UpdateSettingsMsg): Promise<void> {
    const language = this.languageRegistry.getLangByName(msg.language);
    if (!language) throw new Error(`Language not found: ${msg.language}`);
    if (language.defaultValues.compiler !== undefined)
      language.defaultValues.compiler = msg.payload.compiler;
    if (language.defaultValues.compilerArgs !== undefined)
      language.defaultValues.compilerArgs = msg.payload.compilerArgs;
    if (language.defaultValues.interpreter !== undefined)
      language.defaultValues.interpreter = msg.payload.interpreter;
    if (language.defaultValues.interpreterArgs !== undefined)
      language.defaultValues.interpreterArgs = msg.payload.interpreterArgs;
  }
}

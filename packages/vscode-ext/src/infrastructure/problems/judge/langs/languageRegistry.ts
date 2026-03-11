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

import { extname } from 'node:path';
import type { ILanguageRegistry } from '@v/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@v/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import { TOKENS } from '@v/composition/tokens';
import { inject, injectAll, injectable } from 'tsyringe';

@injectable()
export class LanguageRegistry implements ILanguageRegistry {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @injectAll(TOKENS.languageStrategy) private readonly langs: ILanguageStrategy[],
  ) {
    this.logger = logger.withScope('LanguageRegistry');
  }

  public getLang(filePath: string): ILanguageStrategy | undefined {
    const ext = extname(filePath).toLowerCase().slice(1);
    const lang = this.langs.find((lang) => lang.extensions.includes(ext));
    if (lang) this.logger.debug('Detected language for', { filePath, lang: lang.name });
    else this.logger.debug('No language detected for', { filePath });
    return lang;
  }
}

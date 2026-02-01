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
import { inject, injectAll, injectable } from 'tsyringe';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';

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

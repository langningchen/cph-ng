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

import type { GetLanguageListMsg } from '@cph-ng/core';
import { inject, injectAll, injectable } from 'tsyringe';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ISidebarProvider } from '@/application/ports/vscode/ISidebarProvider';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class GetLanguageList implements IMsgHandle<GetLanguageListMsg> {
  public constructor(
    @inject(TOKENS.sidebarProvider) private readonly sidebarProvider: ISidebarProvider,
    @injectAll(TOKENS.languageStrategy) private readonly langs: ILanguageStrategy[],
  ) {}

  public async exec(_msg: GetLanguageListMsg): Promise<void> {
    this.sidebarProvider.sendMessage({
      type: 'languageList',
      payload: Object.fromEntries(this.langs.map((lang) => [lang.name, lang.defaultValues])),
    });
  }
}

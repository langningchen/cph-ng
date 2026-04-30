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

import type { CheckLanguageInfoMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISidebarProvider } from '@/application/ports/vscode/ISidebarProvider';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class CheckLanguageInfo implements IMsgHandle<CheckLanguageInfoMsg> {
  public constructor(
    @inject(TOKENS.languageRegistry) private readonly languageRegistry: ILanguageRegistry,
    @inject(TOKENS.sidebarProvider) private readonly sidebarProvider: ISidebarProvider,
  ) {}

  public async exec(msg: CheckLanguageInfoMsg): Promise<void> {
    const language = this.languageRegistry.getLangByName(msg.language);
    if (!language) throw new Error(`Language not found: ${msg.language}`);
    if (msg.executable === 'compiler') {
      this.sidebarProvider.sendMessage({
        type: 'checkedLanguageInfo',
        language: msg.language,
        executable: msg.executable,
        path: msg.path,
        item: await language.checkCompiler(msg.path),
      });
    }
    if (msg.executable === 'Interpreter') {
      this.sidebarProvider.sendMessage({
        type: 'checkedLanguageInfo',
        language: msg.language,
        executable: msg.executable,
        path: msg.path,
        item: await language.checkInterpreter(msg.path),
      });
    }
  }
}

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

import type { GetLanguageInfoMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import which from 'which';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISidebarProvider } from '@/application/ports/vscode/ISidebarProvider';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class GetLanguageInfo implements IMsgHandle<GetLanguageInfoMsg> {
  public constructor(
    @inject(TOKENS.languageRegistry) private readonly languageRegistry: ILanguageRegistry,
    @inject(TOKENS.sidebarProvider) private readonly sidebarProvider: ISidebarProvider,
  ) {}

  public async exec(msg: GetLanguageInfoMsg): Promise<void> {
    const language = this.languageRegistry.getLangByName(msg.language);
    if (!language) throw new Error(`Language not found: ${msg.language}`);
    if (msg.executable === 'compiler') {
      const compiler = language.defaultValues.compiler;
      this.sidebarProvider.sendMessage({
        type: 'languageInfo',
        language: language.name,
        compilers: {
          default: compiler ? await which(compiler, { nothrow: true }) : null,
          args: language.defaultValues.compilerArgs,
          list: await language.getCompilers(),
        },
      });
    }
    if (msg.executable === 'Interpreter') {
      const runner = language.defaultValues.interpreter;
      this.sidebarProvider.sendMessage({
        type: 'languageInfo',
        language: language.name,
        interpreters: {
          default: runner ? await which(runner, { nothrow: true }) : null,
          args: language.defaultValues.interpreterArgs,
          list: await language.getInterpreters(),
        },
      });
    }
  }
}

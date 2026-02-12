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
import { type ExtensionContext, extensions } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ICompanion } from '@/application/ports/services/ICompanion';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class EnvironmentModule implements IExtensionModule {
  private timer?: NodeJS.Timeout;

  public constructor(
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.companion) private readonly companion: ICompanion,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {}

  public async setup(context: ExtensionContext) {
    if (this.settings.cache.cleanOnStartup) {
      const cacheDir = this.resolver.renderPath(this.settings.cache.directory);
      await this.fs.rm(cacheDir, { force: true, recursive: true }).catch(() => {});
    }

    await this.tmp.startMonitor();
    this.companion.connect();

    let lastAlertTime = 0;
    this.timer = setInterval(async () => {
      const currentTime = Date.now();
      if (
        extensions.getExtension('divyanshuagrawal.competitive-programming-helper')?.isActive &&
        currentTime - lastAlertTime > 5 * 1000
      ) {
        lastAlertTime = currentTime;
        const msg = this.translator.t(
          "CPH-NG cannot run with CPH, but it can load CPH problem file. Please disable CPH to use CPH-NG. You can select the 'Ignore' option to ignore this warning in this session.",
        );
        const okOption = this.translator.t('OK');
        const ignoreOption = this.translator.t('Ignore');
        const result = await this.ui.alert('warn', msg, { modal: true }, okOption, ignoreOption);
        if (result === ignoreOption) clearInterval(this.timer);
      }
    }, 60000);

    context.subscriptions.push({ dispose: () => this.dispose() });
  }

  public dispose() {
    if (this.timer) clearInterval(this.timer);
    this.companion.disconnect();
  }
}

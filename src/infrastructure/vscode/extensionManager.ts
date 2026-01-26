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

import { inject, injectAll, injectable } from 'tsyringe';
import type { ExtensionContext } from 'vscode';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class ExtensionManager {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
    @injectAll(TOKENS.extensionModule) private readonly modules: IExtensionModule[],
  ) {
    this.logger = this.logger.withScope('extensionManager');
  }

  public async activate(context: ExtensionContext) {
    const stopTrace = this.telemetry.start('activate');
    this.logger.info('CPH-NG activating...');

    try {
      for (const module of this.modules) await module.setup(context);
      this.logger.info('CPH-NG activated successfully');
      stopTrace();
    } catch (e) {
      this.logger.error('Activation failed', e);
    }
  }

  public async deactivate() {
    this.logger.info('Deactivating CPH-NG');
    for (const module of this.modules) module.dispose?.();
  }
}

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

import { EventEmitter } from 'node:events';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi, StatusBarController } from '@v/application/ports/vscode/IUi';
import { TOKENS } from '@v/composition/tokens';
import type { BatchList } from '@v/infrastructure/services/companion/companion';
import type { RouterStatus } from '@v/infrastructure/services/companion/companionCommunicationService';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';

type CompanionStatusbarEvents = {
  click: () => void;
};

@injectable()
export class CompanionStatusbarService {
  private statusBarController: StatusBarController;
  public readonly signals = new EventEmitter() as TypedEventEmitter<CompanionStatusbarEvents>;

  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    this.logger = this.logger.withScope('companionStatusBar');
    this.statusBarController = this.ui.showStatusbar('companion', () => this.signals.emit('click'));
  }

  public update(status: RouterStatus, batches: BatchList, detail?: string) {
    this.logger.debug('Updating companion status bar', { status, batchCount: batches.size });
    if (status === 'OFFLINE') {
      return this.statusBarController.update(
        this.translator.t('CPH-NG: Offline'),
        this.translator.t('Click to reconnect'),
        'error',
      );
    }
    if (status === 'CONNECTING') {
      return this.statusBarController.update(
        this.translator.t('CPH-NG: Connecting...'),
        this.translator.t('Launching router and establishing connection'),
        'warn',
      );
    }
    if (status === 'FAILED') {
      return this.statusBarController.update(
        this.translator.t('CPH-NG: Failed'),
        detail
          ? this.translator.t('Router startup failed: {detail}', { detail })
          : this.translator.t('Router startup failed. Click to retry.'),
        'error',
      );
    }

    if (batches.size === 0) {
      const text = this.translator.t('CPH-NG Companion');
      const tooltip = this.translator.t('No batches to claim');
      return this.statusBarController.update(text, tooltip, 'normal');
    }

    if (batches.size === 1) {
      const problems = Array.from(batches.values())[0];
      const text = this.translator.t('{count} problem(s) available', { count: problems.length });
      const tooltip = problems
        .map(({ interactive, timeLimit, memoryLimit, input, output, name, tests, url }) => {
          const details = [];
          if (interactive) details.push(this.translator.t('interactive'));
          details.push(`${timeLimit}ms`);
          details.push(`${memoryLimit}MB`);
          details.push(this.translator.t('{count} test(s)', { count: tests.length }));
          if (input.fileName)
            details.push(this.translator.t('input: {fileName}', { fileName: input.fileName }));
          if (output.fileName)
            details.push(this.translator.t('output: {fileName}', { fileName: output.fileName }));
          return `- **[${name}](${url})** (${details.join(', ')})`;
        })
        .join('\n');
      return this.statusBarController.update(text, tooltip, 'warn');
    }

    const text = this.translator.t('{count} batches to claim', { count: batches.size });
    const tooltip = Array.from(batches.values())
      .map((problems) => `- **${problems.length} problem(s)** (${problems[0].name}, ...)`)
      .join('\n');
    this.statusBarController.update(text, tooltip, 'warn');
  }
}

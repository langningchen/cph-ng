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
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ITemplateRenderer } from '@/application/ports/services/ITemplateRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';

@injectable()
export class TemplateRenderer implements ITemplateRenderer {
  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly pathResolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    this.logger = this.logger.withScope('templateRenderer');
  }

  public async render(problem: Problem): Promise<string> {
    const templateFile = this.settings.problem.templateFile;
    if (!templateFile) {
      this.logger.debug('No template file configured');
      return '';
    }

    const templatePath = this.pathResolver.renderPathWithFile(templateFile, problem.src.path, true);
    if (!templatePath) {
      this.logger.warn('Failed to resolve template path');
      return '';
    }

    try {
      const template = await this.fs.readFile(templatePath);
      return this.renderString(template, [
        ['title', problem.name],
        ['timeLimit', problem.overrides?.timeLimitMs?.toString() ?? '0'],
        ['memoryLimit', problem.overrides?.memoryLimitMb?.toString() ?? '0'],
        ['url', problem.url ?? ''],
      ]);
    } catch (e) {
      this.logger.warn('Failed to read or render template', e);
      this.ui.alert(
        'warn',
        this.translator.t('Failed to use template file: {msg}, creating empty file instead', {
          msg: (e as Error).message,
        }),
      );
      return '';
    }
  }

  private renderString(original: string, replacements: [string, string][]): string {
    for (const [key, value] of replacements) {
      original = original.replaceAll(`\${${key}}`, value);
    }
    return original;
  }
}

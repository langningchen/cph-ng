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

import { existsSync } from 'node:fs';
import {
  basename,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  sep,
} from 'node:path';
import { createContext, Script } from 'node:vm';
import type { CompanionProblem } from '@r/types';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type {
  IUserScriptService,
  WorkspaceFolderContext,
} from '@/application/ports/services/IUserScriptService';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class UserScriptService implements IUserScriptService {
  private outputLogger: ILogger;

  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly pathResolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    this.logger = this.logger.withScope('userScriptService');
    this.outputLogger = this.logger.withScope('userScript');
  }

  public async resolvePaths(
    problems: CompanionProblem[],
    workspaceFolders: WorkspaceFolderContext[],
  ): Promise<(string | null)[] | undefined> {
    if (!this.settings.companion.customPathScript) {
      this.logger.debug('No user script configured');
      return undefined;
    }
    const scriptFile = this.pathResolver.renderPath(this.settings.companion.customPathScript);

    let code: string;
    try {
      code = await this.fs.readFile(scriptFile);
    } catch (e) {
      this.logger.error('Could not read user script', e);
      this.ui.alert('error', this.translator.t('Could not read user script'));
      return undefined;
    }

    const context = createContext({
      URL,
      problems,
      workspaceFolders,
      path: { join, basename, dirname, extname, sep, normalize, isAbsolute, parse, format },
      fs: { existsSync },
      utils: {
        sanitize: (name: string) => name.replace(/[\\/:*?"<>|]/g, '_'),
      },
      logger: {
        trace: (...args: unknown[]) => this.outputLogger.trace('', ...args),
        debug: (...args: unknown[]) => this.outputLogger.debug('', ...args),
        info: (...args: unknown[]) => this.outputLogger.info('', ...args),
        warn: (...args: unknown[]) => this.outputLogger.warn('', ...args),
        error: (...args: unknown[]) => this.outputLogger.error('', ...args),
      },
      ui: {
        chooseFolder: async (title?: string) =>
          await this.ui.chooseFolder(title || this.translator.t('Choose folder for problem')),
        chooseItem: async (items: string[], placeholder?: string) =>
          await this.ui.quickPick(
            items.map((item) => ({ label: item, value: item })),
            { placeHolder: placeholder },
          ),
        input: async (prompt?: string, value?: string) => await this.ui.input({ prompt, value }),
      },
    });

    try {
      const script = new Script(`
        (async () => {
          try {
            ${code}
            return await process();
          } catch (e) {
            logger.error("Error in script", e);
            return null;
          }
        })()
      `);

      const result = await script.runInContext(context, {
        displayErrors: true,
        timeout: 2000,
      });

      this.logger.debug('User script executed', result);

      if (typeof result === 'string') {
        this.ui.alert('error', result);
        return undefined;
      }

      if (Array.isArray(result)) {
        const mapped = result.map((r) => (typeof r === 'string' && r.trim().length > 0 ? r : null));
        if (mapped.some((r) => r !== null && !isAbsolute(r))) {
          this.ui.alert(
            'error',
            this.translator.t('All paths returned by user script must be absolute'),
          );
          return undefined;
        }
        while (mapped.length < problems.length) {
          mapped.push(null);
        }
        return mapped.slice(0, problems.length);
      }

      this.ui.alert('error', this.translator.t('User script does not return a valid path array'));
      return undefined;
    } catch (e) {
      this.logger.error('Error executing user script sandbox', e);
      this.ui.alert('error', this.translator.t('Error executing user script sandbox'));
      return undefined;
    }
  }
}

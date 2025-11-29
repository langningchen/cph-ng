// Copyright (C) 2025 Langning Chen
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

import { renderWorkspacePath } from '@/utils/strTemplate';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
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
} from 'path';
import { createContext, Script } from 'vm';
import { l10n, window } from 'vscode';
import { CompanionProblem } from '../modules/companion';
import FolderChooser from './folderChooser';
import Io from './io';
import Logger from './logger';
import Settings from './settings';

export interface WorkspaceFolderCtx {
  index: number;
  name: string;
  path: string;
}

export default class UserScriptManager {
  private static logger = new Logger('UserScript');
  private static outputChannel = window.createOutputChannel(
    l10n.t('CPH-NG User Script'),
    { log: true },
  );

  public static async resolvePath(
    problems: CompanionProblem[],
    workspaceFolders: WorkspaceFolderCtx[],
  ): Promise<(string | null)[] | undefined> {
    let code: string;
    try {
      const scriptFile = await renderWorkspacePath(
        Settings.companion.customPathScript,
      );
      if (!scriptFile) {
        return;
      }
      code = await readFile(scriptFile, 'utf-8');
    } catch (e) {
      this.logger.error('Could not read user script', e);
      Io.error(l10n.t('Could not read user script'));
      return;
    }

    const context = createContext({
      URL,
      problems,
      workspaceFolders,
      path: {
        join,
        basename,
        dirname,
        extname,
        sep,
        normalize,
        isAbsolute,
        parse,
        format,
      },
      fs: {
        existsSync,
      },
      utils: {
        sanitize: (name: string) => name.replace(/[\\/:*?"<>|]/g, '_'),
      },
      logger: {
        trace: this.outputChannel.trace,
        debug: this.outputChannel.debug,
        info: this.outputChannel.info,
        warn: this.outputChannel.warn,
        error: this.outputChannel.error,
      },
      ui: {
        chooseFolder: async (title?: string) =>
          (
            await FolderChooser.chooseFolder(
              title || l10n.t('Choose folder for problem'),
            )
          )?.fsPath,
        chooseItem: async (items: string[], placeholder?: string) => {
          return await window.showQuickPick(items, {
            placeHolder: placeholder,
          });
        },
        input: async (prompt?: string, value?: string) => {
          return await window.showInputBox({ prompt, value });
        },
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
        Io.error(result);
      } else if (Array.isArray(result)) {
        const mapped = result.map((r) =>
          typeof r === 'string' && r.trim().length > 0 ? r : null,
        );
        if (mapped.some((r) => r !== null && !isAbsolute(r!))) {
          Io.error(
            l10n.t('All paths returned by user script must be absolute'),
          );
          return;
        }
        while (mapped.length < problems.length) {
          mapped.push(null);
        }
        return mapped.slice(0, problems.length);
      } else {
        Io.error(l10n.t('User script does not return a valid path array'));
      }
    } catch (e) {
      this.logger.error('Error executing user script sandbox', e);
      Io.error(l10n.t('Error executing user script sandbox'));
    }
  }
}

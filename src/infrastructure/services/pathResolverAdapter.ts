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

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Expected curly for resolver

import { existsSync } from 'node:fs';
import { inject, injectable } from 'tsyringe';
import { Uri, window, workspace } from 'vscode';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class PathResolverAdapter implements IPathResolver {
  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.system) private readonly sys: ISystem,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    this.logger = this.logger.withScope('pathResolver');
  }

  private renderString(original: string, replacements: [string, string][]): string {
    let result = original;
    for (const [key, value] of replacements) result = result.replaceAll(`\${${key}}`, value);
    this.logger.trace('Rendered string', { original, result });
    return result;
  }

  private _renderPath(original: string): string {
    return this.path.resolve(
      this.renderString(original, [
        ['tmp', this.sys.tmpdir()],
        ['home', this.sys.homedir()],
        ['extensionPath', this.extPath],
      ]),
    );
  }

  public renderPath(original: string): string {
    const result = this._renderPath(original);
    this.logger.trace('Rendered path', { original, result });
    return result;
  }

  public async renderWorkspacePath(original: string): Promise<string | null> {
    let result = this._renderPath(original);
    if (!result.includes('${workspace}')) return result;

    const folders = workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.ui.alert(
        'error',
        this.translator.t('Path uses ${workspace}, but no workspace folder is open.'),
      );
      this.logger.warn('No workspace folder is open for path rendering.', { original });
      return null;
    }

    const candidates = folders
      .map((f) => ({
        wsPath: f.uri.fsPath,
        rendered: this.renderString(result, [['workspace', f.uri.fsPath]]),
      }))
      .filter(({ rendered }) => existsSync(this.path.dirname(rendered)));
    this.logger.trace('Tried workspace paths for rendering', {
      original,
      candidates: candidates.map((c) => c.rendered),
    });

    if (candidates.length === 0) {
      this.ui.alert('error', this.translator.t('No workspace folder contains the required path.'));
      this.logger.warn('No workspace folder contains the required path.', { original });
      return null;
    }

    let selectedWsPath: string;
    if (candidates.length === 1) {
      selectedWsPath = candidates[0].wsPath;
    } else {
      const picked = await window.showQuickPick(
        candidates.map((c) => c.wsPath),
        { title: this.translator.t('Select workspace folder') },
      );
      if (!picked) {
        this.logger.info('No workspace folder selected for path rendering.', { original });
        return null;
      }
      selectedWsPath = picked;
    }

    result = this.renderString(result, [['workspace', selectedWsPath]]);
    this.logger.trace('Rendered workspace path', { original, result });
    return result;
  }

  public renderPathWithFile(
    original: string,
    filePath: string,
    ignoreError: boolean = false,
  ): string | null {
    const uri = Uri.file(filePath);
    const workspaceFolder = workspace.getWorkspaceFolder(uri);

    const dir = this.path.dirname(filePath);
    const ext = this.path.extname(filePath);
    const base = this.path.basename(filePath);
    const baseNoExt = this.path.basename(filePath, ext);

    let result = original;

    if (result.includes('${workspace}') || result.includes('${relativeDirname}')) {
      if (!workspaceFolder) {
        if (!ignoreError) {
          this.ui.alert('error', this.translator.t('File is not in a workspace folder.'));
        }
        this.logger.warn('File is not in a workspace folder.', { filePath, original });
        return null;
      }
      const wsPath = workspaceFolder.uri.fsPath;
      result = this.renderString(result, [
        ['workspace', wsPath],
        ['relativeDirname', this.path.relative(wsPath, dir) || '.'],
      ]);
    }

    result = this.path.resolve(
      this.renderString(this._renderPath(result), [
        ['dirname', dir],
        ['extname', ext],
        ['basename', base],
        ['basenameNoExt', baseNoExt],
      ]),
    );
    this.logger.trace('Rendered path with file', { original, filePath, result });
    return result;
  }

  public renderUnzipFolder(srcPath: string, zipPath: string): string | null {
    const original = this.renderPathWithFile(this.settings.problem.unzipFolder, srcPath);
    if (!original) return null;

    const dir = this.path.dirname(zipPath);
    const ext = this.path.extname(zipPath);
    const base = this.path.basename(zipPath);
    const baseNoExt = this.path.basename(zipPath, ext);

    const result = this.path.resolve(
      this.renderString(original, [
        ['zipDirname', dir],
        ['zipBasename', base],
        ['zipBasenameNoExt', baseNoExt],
      ]),
    );
    this.logger.trace('Rendered unzip folder', { srcPath, zipPath, result });
    return result;
  }
}

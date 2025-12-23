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

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Expected curly for renderer

import { existsSync } from 'node:fs';
import { basename, dirname, extname, normalize, relative } from 'node:path';
import { inject, injectable } from 'tsyringe';
import { Uri, window, workspace } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/types/types.backend';

// TO-DO: Check the refactor: workspace selection

@injectable()
export class PathRendererAdapter implements IPathRenderer {
  constructor(
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
    @inject(TOKENS.ExtensionPath) private readonly path: string,
  ) {}

  private renderString(
    original: string,
    replacements: [string, string][],
  ): string {
    let result = original;
    for (const [key, value] of replacements) {
      result = result.replaceAll(`\${${key}}`, value);
    }
    return result;
  }

  public async renderTemplate(problem: Problem): Promise<string> {
    const templatePath = this.renderPathWithFile(
      this.settings.problem.templateFile,
      problem.src.path,
    );

    if (!templatePath || !this.fs.exists(templatePath)) {
      return '';
    }

    try {
      const template = await this.fs.readFile(templatePath, 'utf-8');
      return this.renderString(template, [
        ['title', problem.name],
        ['timeLimit', problem.timeLimit.toString()],
        ['memoryLimit', problem.memoryLimit.toString()],
        ['url', problem.url || ''],
      ]);
    } catch (e) {
      this.logger.error(`Failed to read template: ${templatePath}`, e as Error);
      return '';
    }
  }

  public renderPath(original: string): string {
    return this.fs.normalize(
      this.renderString(original, [
        ['tmp', this.fs.tmpdir()],
        ['home', this.fs.homedir()],
        ['extensionPath', this.path],
      ]),
    );
  }

  public async renderWorkspacePath(original: string): Promise<string | null> {
    let rendered = this.renderPath(original);

    if (rendered.includes('${workspace}')) {
      const folders = workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        this.logger.error(
          this.translator.t(
            'Path uses ${workspace}, but no workspace folder is open.',
          ),
        );
        return null;
      }

      const validFolders = folders
        .map((f) => f.uri.fsPath)
        .filter((path) =>
          existsSync(this.renderString(rendered, [['workspace', path]])),
        );

      if (validFolders.length === 0) {
        this.logger.error(
          this.translator.t('No workspace folder contains the required path.'),
        );
        return null;
      }

      let selectedFolder: string;
      if (validFolders.length === 1) {
        selectedFolder = validFolders[0];
      } else {
        const picked = await window.showQuickPick(validFolders, {
          title: this.translator.t('Select workspace folder'),
        });
        if (!picked) return null;
        selectedFolder = picked;
      }

      rendered = this.renderString(rendered, [['workspace', selectedFolder]]);
    }
    return rendered;
  }

  public renderPathWithFile(
    original: string,
    filePath: string,
    ignoreError: boolean = false,
  ): string | null {
    const uri = Uri.file(filePath);
    const workspaceFolder = workspace.getWorkspaceFolder(uri);

    const dirnameV = dirname(filePath);
    const extnameV = extname(filePath);
    const basenameV = basename(filePath);
    const basenameNoExt = basename(filePath, extnameV);

    let result = original;

    if (
      result.includes('${workspace}') ||
      result.includes('${relativeDirname}')
    ) {
      if (!workspaceFolder) {
        if (!ignoreError) {
          this.logger.error(
            this.translator.t('File is not in a workspace folder.'),
          );
        }
        return null;
      }
      const wsPath = workspaceFolder.uri.fsPath;
      result = this.renderString(result, [
        ['workspace', wsPath],
        ['relativeDirname', relative(wsPath, dirnameV) || '.'],
      ]);
    }

    return normalize(
      this.renderString(this.renderPath(result), [
        ['dirname', dirnameV],
        ['extname', extnameV],
        ['basename', basenameV],
        ['basenameNoExt', basenameNoExt],
      ]),
    );
  }

  public renderUnzipFolder(srcPath: string, zipPath: string): string | null {
    const original = this.renderPathWithFile(
      this.settings.problem.unzipFolder,
      srcPath,
    );
    if (!original) return null;

    return normalize(
      this.renderString(original, [
        ['zipDirname', dirname(zipPath)],
        ['zipBasename', basename(zipPath)],
        ['zipBasenameNoExt', basename(zipPath, extname(zipPath))],
      ]),
    );
  }
}

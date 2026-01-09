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
import {
  FileType,
  type OpenDialogOptions,
  type SaveDialogOptions,
  Uri,
  window,
  workspace,
} from 'vscode';
import type { IPath } from '@/application/ports/node/IPath';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type {
  AlertLevel,
  CustomOpenDialogOptions,
  CustomQuickPickItem,
  CustomQuickPickOptions,
  CustomSaveDialogOptions,
  IUi,
} from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class UiAdapter implements IUi {
  constructor(
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Path) private readonly path: IPath,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
  ) {
    this.logger = this.logger.withScope('UiAdapter');
  }

  public async openDialog(options: CustomOpenDialogOptions): Promise<string | undefined> {
    const vscodeOptions: OpenDialogOptions = { ...options };
    if (options.defaultPath) vscodeOptions.defaultUri = Uri.file(options.defaultPath);
    const uri = await window.showOpenDialog(vscodeOptions);
    return uri && uri.length > 0 ? uri[0].fsPath : undefined;
  }

  public async saveDialog(options: CustomSaveDialogOptions): Promise<string | undefined> {
    const vscodeOptions: SaveDialogOptions = { ...options };
    if (options.defaultPath) vscodeOptions.defaultUri = Uri.file(options.defaultPath);
    const uri = await window.showSaveDialog(vscodeOptions);
    return uri ? uri.fsPath : undefined;
  }

  private async getSubfoldersRecursively(folderUri: Uri): Promise<Uri[]> {
    this.logger.trace('getSubfoldersRecursively', { folderUri });
    const subfolders: Uri[] = [];
    const entries = await workspace.fs.readDirectory(folderUri);
    for (const [name, type] of entries) {
      if (type === FileType.Directory && name[0] !== '.') {
        const subfolderUri = Uri.joinPath(folderUri, name);
        subfolders.push(subfolderUri);
        const nestedSubfolders = await this.getSubfoldersRecursively(subfolderUri);
        subfolders.push(...nestedSubfolders);
      }
    }
    return subfolders;
  }

  private async chooseFolderWithDialog(title: string): Promise<string | undefined> {
    this.logger.trace('chooseFolderWithDialog', { title });
    return await this.openDialog({
      canSelectMany: false,
      title,
      canSelectFolders: true,
      canSelectFiles: false,
    });
  }

  private async chooseFolderWithQuickPick(title: string): Promise<string | undefined | null> {
    this.logger.trace('chooseFolderWithQuickPick', { title });
    if (!workspace.workspaceFolders) return null;

    const subfolders = await Promise.all(
      workspace.workspaceFolders.map(async (folder) => [
        ...(await this.getSubfoldersRecursively(folder.uri)).map((uri) => ({
          folder,
          uri,
        })),
        { folder, uri: folder.uri },
      ]),
    ).then((results) => results.flat());
    this.logger.debug('Got subfolders', { subfolders });

    const selected = await window.showQuickPick(
      subfolders.map((subfolder) => ({
        label: this.path.join(
          subfolder.folder.name,
          this.path.relative(subfolder.folder.uri.fsPath, subfolder.uri.fsPath) || '.',
        ),
        details: subfolder.uri.fsPath,
      })),
      { title },
    );
    if (!selected) return undefined;
    return selected.details;
  }

  public async confirm(title: string): Promise<boolean> {
    const yes = this.translator.t('Yes');
    const choice = await window.showInformationMessage(title, { modal: true }, yes);
    return choice === yes;
  }

  public async quickPick<T>(
    items: CustomQuickPickItem<T>[],
    options: CustomQuickPickOptions,
  ): Promise<T | undefined> {
    options.ignoreFocusOut ??= true;
    const selected = await window.showQuickPick(items, options);
    return selected?.value;
  }

  public async quickPickMany<T>(
    items: CustomQuickPickItem<T>[],
    options: CustomQuickPickOptions,
  ): Promise<T[]> {
    options.ignoreFocusOut ??= true;
    const selected = await window.showQuickPick(items, { ...options, canPickMany: true });
    return selected?.map((s) => s.value) ?? [];
  }

  public async chooseFolder(title: string): Promise<string | undefined> {
    this.logger.trace('chooseFolder', { title });
    if (this.settings.basic.folderOpener === 'flat') {
      const result = await this.chooseFolderWithQuickPick(title);
      if (result !== null) return result;
    }
    return await this.chooseFolderWithDialog(title);
  }

  public alert(level: AlertLevel, title: string): void {
    if (level === 'warn') window.showWarningMessage(title);
  }
}

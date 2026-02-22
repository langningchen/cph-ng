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
  commands,
  FileType,
  MarkdownString,
  type OpenDialogOptions,
  ProgressLocation,
  type SaveDialogOptions,
  StatusBarAlignment,
  ThemeColor,
  Uri,
  window,
  workspace,
} from 'vscode';
import type { IPath } from '@/application/ports/node/IPath';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type {
  AlertArgs,
  AlertLevel,
  CustomOpenDialogOptions,
  CustomQuickPickItem,
  CustomQuickPickOptions,
  CustomSaveDialogOptions,
  InputOptions,
  IUi,
  ProgressController,
  StatusBarController,
} from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class UiAdapter implements IUi {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.settings) private readonly settings: ISettings,
  ) {
    this.logger = this.logger.withScope('uiAdapter');
  }

  public async openDialog(options: CustomOpenDialogOptions): Promise<string | undefined> {
    this.logger.trace('Showing open dialog', { options });
    const vscodeOptions: OpenDialogOptions = { ...options };
    if (options.defaultPath) vscodeOptions.defaultUri = Uri.file(options.defaultPath);
    const uri = await window.showOpenDialog(vscodeOptions);
    const path = uri && uri.length > 0 ? uri[0].fsPath : undefined;
    this.logger.debug('Open dialog result', { path });
    return path;
  }

  public async saveDialog(options: CustomSaveDialogOptions): Promise<string | undefined> {
    this.logger.trace('Showing save dialog', { options });
    const vscodeOptions: SaveDialogOptions = { ...options };
    if (options.defaultPath) vscodeOptions.defaultUri = Uri.file(options.defaultPath);
    const uri = await window.showSaveDialog(vscodeOptions);
    const path = uri ? uri.fsPath : undefined;
    this.logger.debug('Save dialog result', { path });
    return path;
  }

  private async getSubfoldersRecursively(folderUri: Uri): Promise<Uri[]> {
    this.logger.trace('Recursing into folder', { folderUri });
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
    return await this.openDialog({
      canSelectMany: false,
      title,
      canSelectFolders: true,
      canSelectFiles: false,
    });
  }

  private async chooseFolderWithQuickPick(title: string): Promise<string | undefined | null> {
    // If there is no workspace opened, return null to indicate fallback
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
    this.logger.trace('Showing confirmation dialog', { title });
    const yes = this.translator.t('Yes');
    const choice = await window.showInformationMessage(title, { modal: true }, yes);
    const result = choice === yes;
    this.logger.debug('Confirmation result', { result });
    return result;
  }

  public async quickPick<T>(
    items: CustomQuickPickItem<T>[],
    options: CustomQuickPickOptions,
  ): Promise<T | undefined> {
    this.logger.trace('Showing quick pick', { items, options });
    options.ignoreFocusOut ??= true;
    const selected = await window.showQuickPick(items, options);
    const value = selected?.value;
    this.logger.debug('Quick pick selected', { value });
    return value;
  }

  public async quickPickMany<T>(
    items: CustomQuickPickItem<T>[],
    options: CustomQuickPickOptions,
  ): Promise<T[]> {
    this.logger.trace('Showing quick pick many', { items, options });
    options.ignoreFocusOut ??= true;
    const selected = await window.showQuickPick(items, { ...options, canPickMany: true });
    const values = selected?.map((s) => s.value) ?? [];
    this.logger.debug('Quick pick many selected', { values });
    return values;
  }

  public async chooseFolder(title: string): Promise<string | undefined> {
    this.logger.trace('Choosing folder', { title });
    if (this.settings.basic.folderOpener === 'flat') {
      const result = await this.chooseFolderWithQuickPick(title);
      if (result !== null) {
        this.logger.debug('Folder chosen with quick pick', { result });
        return result;
      }
      this.logger.warn('No workspace folders found, falling back to dialog folder chooser');
    }
    const result = await this.chooseFolderWithDialog(title);
    this.logger.debug('Folder chosen with dialog', { result });
    return result;
  }

  public async input(options: InputOptions): Promise<string | undefined> {
    this.logger.trace('Showing input box', { options });
    const result = await window.showInputBox({
      prompt: options.prompt,
      value: options.value,
      placeHolder: options.placeHolder,
      password: options.password,
      ignoreFocusOut: true,
    });
    this.logger.debug('Input box result', { result });
    return result;
  }

  public async alert(
    level: AlertLevel,
    message: string,
    ...args: AlertArgs
  ): Promise<string | undefined> {
    this.logger.trace('Showing alert', { level, message, args });
    // biome-ignore lint/suspicious/noExplicitAny: Casting to any is required to match the overloaded signature.
    const safeArgs = args as any[];
    if (level === 'warn') return await window.showWarningMessage(message, ...safeArgs);
    if (level === 'error') return await window.showErrorMessage(message, ...safeArgs);
    if (level === 'info') return await window.showInformationMessage(message, ...safeArgs);
  }

  public openFile(uri: Uri): void {
    this.logger.trace('Opening file', { uri });
    commands.executeCommand('vscode.open', uri, this.settings.companion.showPanel);
  }

  public openChat(topic: string): void {
    this.logger.trace('Opening chat', { topic });
    commands.executeCommand('workbench.action.chat.open', {
      mode: 'agent',
      query: topic,
      isPartialQuery: true,
    });
  }

  public openSettings(item: string): void {
    this.logger.trace('Opening settings', { item });
    commands.executeCommand('workbench.action.openSettings', item);
  }

  public compareFiles(left: Uri, right: Uri): void {
    this.logger.trace('Comparing files', { left, right });
    commands.executeCommand('vscode.diff', left, right);
  }

  public showSidebar(): void {
    this.logger.trace('Showing sidebar');
    const editor = window.activeTextEditor;
    commands.executeCommand('workbench.view.extension.cphNgContainer');
    if (editor) window.showTextDocument(editor.document);
  }

  public progress(title: string, onCancel?: () => void): ProgressController {
    this.logger.trace('Showing progress', { title });
    let report: (value: { message?: string; increment?: number }) => void = () => {};
    let done: () => void;
    const donePromise = new Promise<void>((resolve) => {
      done = resolve;
    });
    window.withProgress(
      { location: ProgressLocation.Notification, title, cancellable: !!onCancel },
      async (progress, token) => {
        report = progress.report.bind(progress);
        token.onCancellationRequested(() => {
          this.logger.debug('Progress cancelled');
          onCancel?.();
          done();
        });
        await donePromise;
      },
    );
    return {
      report: (value) => report(value),
      done: () => {
        done();
      },
    };
  }

  public showStatusbar(id: string, onClick: () => void): StatusBarController {
    this.logger.trace('Showing status bar', { id });
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    const commandId = `cphNg.statusBar.${id}`;
    const disposable = commands.registerCommand(commandId, onClick);
    statusBarItem.command = commandId;
    statusBarItem.show();
    return {
      update: (text, tooltip, color) => {
        this.logger.debug('Updating status bar', { text, tooltip, color });
        statusBarItem.text = text;
        statusBarItem.tooltip = new MarkdownString(tooltip);
        statusBarItem.backgroundColor = {
          error: new ThemeColor('statusBarItem.errorBackground'),
          warn: new ThemeColor('statusBarItem.warningBackground'),
          normal: undefined,
        }[color];
      },
      show: () => {
        this.logger.trace('Showing status bar item');
        statusBarItem.show();
      },
      hide: () => {
        this.logger.trace('Hiding status bar item');
        statusBarItem.hide();
      },
      dispose: () => {
        this.logger.trace('Hiding status bar');
        statusBarItem.dispose();
        disposable.dispose();
      },
    };
  }
}

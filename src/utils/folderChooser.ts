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

import * as vscode from 'vscode';
import Settings from './settings';
import { io, Logger } from './io';
import { join, relative } from 'path';

export class FolderChooser {
    private static logger: Logger = new Logger('folderChooser');

    static async getSubfoldersRecursively(
        folderUri: vscode.Uri,
    ): Promise<vscode.Uri[]> {
        this.logger.trace('getSubfoldersRecursively', { folderUri });
        const subfolders: vscode.Uri[] = [];
        const entries = await vscode.workspace.fs.readDirectory(folderUri);
        for (const [name, type] of entries) {
            if (type === vscode.FileType.Directory && name[0] !== '.') {
                const subfolderUri = vscode.Uri.joinPath(folderUri, name);
                subfolders.push(subfolderUri);
                const nestedSubfolders =
                    await this.getSubfoldersRecursively(subfolderUri);
                subfolders.push(...nestedSubfolders);
            }
        }
        return subfolders;
    }

    static async chooseFolderWithDialog(
        title: string,
    ): Promise<vscode.Uri | null> {
        this.logger.trace('chooseFolderWithDialog', { title });
        const folderUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            title,
            canSelectFolders: true,
            canSelectFiles: false,
        });
        if (folderUri && folderUri[0]) {
            return folderUri[0];
        } else {
            return null;
        }
    }

    static async chooseFolderWithQuickPick(
        title: string,
    ): Promise<vscode.Uri | null> {
        this.logger.trace('chooseFolderWithQuickPick', { title });
        if (!vscode.workspace.workspaceFolders) {
            io.error(vscode.l10n.t('No workspace folder is open.'));
            return null;
        }

        const subfolders = await Promise.all(
            vscode.workspace.workspaceFolders.map(async (folder) => [
                ...(await this.getSubfoldersRecursively(folder.uri)).map(
                    (uri) => ({ folder, uri }),
                ),
                { folder, uri: folder.uri },
            ]),
        ).then((results) => results.flat());
        this.logger.debug('Got subfolders', { subfolders });

        const selected = await vscode.window.showQuickPick(
            subfolders.map((subfolder) => ({
                label: join(
                    subfolder.folder.name,
                    relative(subfolder.folder.uri.fsPath, subfolder.uri.fsPath),
                ),
                details: subfolder.uri.fsPath,
            })),
            {
                title,
            },
        );

        if (!selected) {
            return null;
        }
        return vscode.Uri.file(selected.details);
    }

    static async chooseFolder(title: string): Promise<vscode.Uri | null> {
        this.logger.trace('chooseFolder', { title });
        if (Settings.basic.folderOpener === 'tree') {
            return await this.chooseFolderWithDialog(title);
        } else {
            return await this.chooseFolderWithQuickPick(title);
        }
    }
}

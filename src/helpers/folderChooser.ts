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

import Logger from '@/helpers/logger';
import { join, relative } from 'path';
import { FileType, l10n, Uri, window, workspace } from 'vscode';
import Io from './io';
import Settings from './settings';

export default class FolderChooser {
    private static logger: Logger = new Logger('folderChooser');

    private static async getSubfoldersRecursively(
        folderUri: Uri,
    ): Promise<Uri[]> {
        this.logger.trace('getSubfoldersRecursively', { folderUri });
        const subfolders: Uri[] = [];
        const entries = await workspace.fs.readDirectory(folderUri);
        for (const [name, type] of entries) {
            if (type === FileType.Directory && name[0] !== '.') {
                const subfolderUri = Uri.joinPath(folderUri, name);
                subfolders.push(subfolderUri);
                const nestedSubfolders =
                    await this.getSubfoldersRecursively(subfolderUri);
                subfolders.push(...nestedSubfolders);
            }
        }
        return subfolders;
    }

    private static async chooseFolderWithDialog(
        title: string,
    ): Promise<Uri | null> {
        this.logger.trace('chooseFolderWithDialog', { title });
        const folderUri = await window.showOpenDialog({
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

    private static async chooseFolderWithQuickPick(
        title: string,
    ): Promise<Uri | null> {
        this.logger.trace('chooseFolderWithQuickPick', { title });
        if (!workspace.workspaceFolders) {
            Io.error(l10n.t('No workspace folder is open.'));
            return null;
        }

        const subfolders = await Promise.all(
            workspace.workspaceFolders.map(async (folder) => [
                ...(await this.getSubfoldersRecursively(folder.uri)).map(
                    (uri) => ({ folder, uri }),
                ),
                { folder, uri: folder.uri },
            ]),
        ).then((results) => results.flat());
        this.logger.debug('Got subfolders', { subfolders });

        const selected = await window.showQuickPick(
            subfolders.map((subfolder) => ({
                label: join(
                    subfolder.folder.name,
                    relative(
                        subfolder.folder.uri.fsPath,
                        subfolder.uri.fsPath,
                    ) || '.',
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
        return Uri.file(selected.details);
    }

    static async chooseFolder(title: string): Promise<Uri | null> {
        this.logger.trace('chooseFolder', { title });
        if (Settings.basic.folderOpener === 'tree') {
            return await this.chooseFolderWithDialog(title);
        } else {
            return await this.chooseFolderWithQuickPick(title);
        }
    }
}

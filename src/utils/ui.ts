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

import AdmZip from 'adm-zip';
import { mkdir, readdir, unlink } from 'fs/promises';
import { orderBy } from 'natural-orderby';
import { basename, dirname, extname, join, relative } from 'path';
import * as vscode from 'vscode';
import FolderChooser from '../helpers/folderChooser';
import Io from '../helpers/io';
import Settings from '../modules/settings';
import { WebviewSrcFileTypes, WebviewTcFileTypes } from '../webview/msgs';
import { exists } from './process';
import { renderTemplate } from './strTemplate';
import { TC } from './types';

async function getAllFiles(dirPath: string): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(
        entries.map((entry) => {
            const fullPath = join(dirPath, entry.name);
            return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
        }),
    );
    return files.flat();
}
export const getTcs = async (srcPath: string): Promise<TC[]> => {
    const option = (
        await vscode.window.showQuickPick(
            [
                {
                    label: vscode.l10n.t('Load from a zip file'),
                    value: 'zip',
                },
                {
                    label: vscode.l10n.t('Load from a folder'),
                    value: 'folder',
                },
            ],
            { canPickMany: false },
        )
    )?.value;
    if (!option) {
        return [];
    }

    let folderPath = '';
    if (option === 'zip') {
        const zipFile = await vscode.window.showOpenDialog({
            title: vscode.l10n.t('Choose a zip file containing test cases'),
            filters: { 'Zip files': ['zip'], 'All files': ['*'] },
        });
        if (!zipFile) {
            return [];
        }
        const zipPath = zipFile[0].fsPath;
        const zipData = new AdmZip(zipPath);
        const srcUri = vscode.Uri.file(srcPath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(srcUri);
        if (!workspaceFolder) {
            return [];
        }
        const workspacePath = workspaceFolder.uri.fsPath;
        folderPath = renderTemplate(Settings.problem.unzipFolder, [
            ['workspace', workspacePath],
            ['dirname', dirname(srcPath)],
            [
                'relativeDirname',
                relative(workspacePath, dirname(srcPath)) || '.',
            ],
            ['basename', basename(srcPath)],
            ['extname', extname(srcPath)],
            ['basenameNoExt', basename(srcPath, extname(srcPath))],
            ['zipDirname', dirname(zipPath)],
            ['zipBasename', basename(zipPath)],
            ['zipBasenameNoExt', basename(zipPath, extname(zipPath))],
        ]);
        await mkdir(folderPath, { recursive: true });
        zipData.extractAllTo(folderPath, true);
        if (Settings.problem.deleteAfterUnzip) {
            await unlink(zipPath);
        }
    } else if (option === 'folder') {
        const folderUri = await FolderChooser.chooseFolder(
            vscode.l10n.t('Choose a folder containing test cases'),
        );
        if (!folderUri) {
            return [];
        }
        folderPath = folderUri.fsPath;
    }

    const allFiles = await getAllFiles(folderPath);
    const tcs: TC[] = [];
    for (const filePath of allFiles) {
        const fileName = basename(filePath);
        const ext = extname(fileName).toLowerCase();
        if (ext === '.in') {
            tcs.push({
                stdin: { useFile: true, path: filePath },
                answer: { useFile: false, data: '' },
                isExpand: false,
            });
        }
    }
    for (const filePath of allFiles) {
        const fileName = basename(filePath);
        const ext = extname(fileName).toLowerCase();
        if (ext === '.ans' || ext === '.out') {
            const inputFile = join(
                dirname(filePath),
                fileName.replace(ext, '.in'),
            );
            const existingTestCase = tcs.find(
                (tc) => tc.stdin.useFile && tc.stdin.path === inputFile,
            );
            if (existingTestCase) {
                existingTestCase.answer = {
                    useFile: true,
                    path: filePath,
                };
            } else {
                tcs.push({
                    stdin: { useFile: false, data: '' },
                    answer: { useFile: true, path: filePath },
                    isExpand: false,
                });
            }
        }
    }
    if (!tcs.length) {
        Io.warn(vscode.l10n.t('No test cases found in the zip file.'));
        return [];
    }
    const orderedTcs = orderBy(tcs, [
        (it) => (it.stdin.useFile ? 0 : 1),
        (it) =>
            it.stdin.useFile
                ? basename(it.stdin.path)
                : it.answer.useFile
                  ? basename(it.answer.path)
                  : '',
    ]);
    const chosenIdx = await vscode.window.showQuickPick(
        orderedTcs.map((tc, idx) => ({
            label: `${basename(
                tc.stdin.useFile
                    ? tc.stdin.path
                    : tc.answer.useFile
                      ? tc.answer.path
                      : 'unknown',
            )}`,
            description: vscode.l10n.t('Input {input}, Answer {answer}', {
                input: tc.stdin.useFile
                    ? tc.stdin.path.replace(folderPath + '/', '')
                    : vscode.l10n.t('not found'),
                answer: tc.answer.useFile
                    ? tc.answer.path.replace(folderPath + '/', '')
                    : vscode.l10n.t('not found'),
            }),
            value: idx,
            picked: true,
        })),
        {
            canPickMany: true,
            title: vscode.l10n.t('Select test cases to add'),
        },
    );
    if (!chosenIdx) {
        return [];
    }
    return chosenIdx.map((idx) => orderedTcs[idx.value]);
};

export const chooseTcFile = async (
    option: WebviewTcFileTypes,
): Promise<{ stdin?: string; answer?: string }> => {
    const isInput = option === 'stdin';
    const mainExt = isInput ? ['in'] : ['ans', 'out'];
    const pairExt = isInput ? ['ans', 'out'] : ['in'];
    const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: vscode.l10n.t('Choose {type} file', {
            type: isInput ? vscode.l10n.t('stdin') : vscode.l10n.t('answer'),
        }),
        filters: {
            [vscode.l10n.t('Text files')]: mainExt,
            [vscode.l10n.t('All files')]: ['*'],
        },
    });
    if (!fileUri || !fileUri.length) {
        return {};
    }
    const path = fileUri[0].fsPath;

    let stdin: string | undefined, answer: string | undefined;
    isInput ? (stdin = path) : (answer = path);
    const behavior = Settings.problem.foundMatchTestCaseBehavior;

    if (behavior === 'never') {
        return { stdin, answer };
    }
    for (const ext of pairExt) {
        const pairPath = path.replace(extname(path), `.${ext}`);
        if (!(await exists(pairPath))) {
            continue;
        }
        if (
            behavior === 'ask' &&
            !(await Io.confirm(
                vscode.l10n.t(
                    'Found matching {found} file: {file}. Do you want to use it?',
                    {
                        found: isInput
                            ? vscode.l10n.t('answer')
                            : vscode.l10n.t('stdin'),
                        file: basename(pairPath),
                    },
                ),
                true,
            ))
        ) {
            continue;
        }
        isInput ? (answer = pairPath) : (stdin = pairPath);
        break;
    }
    return { stdin, answer };
};

export const chooseSrcFile = async (
    fileType: WebviewSrcFileTypes,
): Promise<string | null> => {
    const checkerFileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: vscode.l10n.t('Select {fileType} File', {
            fileType: {
                checker: vscode.l10n.t('Checker'),
                interactor: vscode.l10n.t('Interactor'),
                generator: vscode.l10n.t('Generator'),
                bruteForce: vscode.l10n.t('Brute Force'),
            }[fileType],
        }),
    });
    if (!checkerFileUri) {
        return null;
    }
    return checkerFileUri[0].fsPath;
};

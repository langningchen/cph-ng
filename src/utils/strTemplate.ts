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

import Io from '@/helpers/io';
import Settings from '@/helpers/settings';
import { readFile } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { basename, dirname, extname, normalize, relative } from 'path';
import { l10n, Uri, workspace } from 'vscode';
import { Problem } from '../types/types.backend';
import { extensionPath } from './global';

const renderString = (original: string, replacements: [string, string][]) => {
    for (const replacement of replacements) {
        original = original.replaceAll(`\${${replacement[0]}}`, replacement[1]);
    }
    return original;
};

export const renderTemplate = async (problem: Problem) => {
    const templatePath = renderPathWithFile(
        Settings.problem.templateFile,
        problem.src.path,
    );
    if (!templatePath) {
        return '';
    }
    const template = await readFile(templatePath, 'utf-8');
    return renderString(template, [
        ['title', problem.name],
        ['timeLimit', problem.timeLimit.toString()],
        ['memoryLimit', problem.memoryLimit.toString()],
        ['url', problem.url || ''],
    ]);
};
export const renderPath = (original: string) => {
    return normalize(
        renderString(original, [
            ['tmp', tmpdir()],
            ['home', homedir()],
            ['extensionPath', extensionPath],
        ]),
    );
};
export const renderPathWithFile = (
    original: string,
    path: string,
    ignoreError: boolean = false,
) => {
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(path));
    const dirnameV = dirname(path);
    const extnameV = extname(path);
    const basenameV = basename(path);
    const basenameNoExt = basename(path, extnameV);
    if (
        original.includes('${workspace}') ||
        original.includes('${relativeDirname}')
    ) {
        if (!workspaceFolder) {
            ignoreError ||
                Io.error(
                    l10n.t(
                        'Path uses ${workspace} or ${relativeDirname}, but file is not in a workspace folder.',
                    ),
                );
            return null;
        }
        const workspace = workspaceFolder.uri.fsPath;
        original = renderString(original, [
            ['workspace', workspace],
            ['relativeDirname', relative(workspace, dirnameV) || '.'],
        ]);
    }
    return normalize(
        renderString(renderPath(original), [
            ['dirname', dirnameV],
            ['extname', extnameV],
            ['basename', basenameV],
            ['basenameNoExt', basenameNoExt],
        ]),
    );
};
export const renderUnzipFolder = (srcPath: string, zipPath: string) => {
    const original = renderPathWithFile(Settings.problem.unzipFolder, srcPath);
    return (
        original &&
        normalize(
            renderString(original, [
                ['zipDirname', dirname(zipPath)],
                ['zipBasename', basename(zipPath)],
                ['zipBasenameNoExt', basename(zipPath, extname(zipPath))],
            ]),
        )
    );
};

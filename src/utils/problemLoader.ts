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

import { readFile } from 'fs/promises';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import * as vscode from 'vscode';
import { migration, OldProblem } from './migration';
import { Problem } from './types';
import Logger from '../helpers/logger';

const logger = new Logger('problemLoader');

/**
 * Utility function to load a problem from a CPH-NG .bin file
 * @param binFilePath Path to the .bin file
 * @returns Promise that resolves to the loaded Problem or undefined if loading fails
 */
export async function loadProblemFromBinFile(binFilePath: string): Promise<Problem | undefined> {
    logger.trace('loadProblemFromBinFile', { binFilePath });
    try {
        const data = await readFile(binFilePath);
        const problem = migration(
            JSON.parse(
                gunzipSync(data).toString(),
            ) satisfies OldProblem,
        );
        logger.debug('Loaded problem from bin file', {
            binFilePath,
            problem,
        });
        return problem;
    } catch (error) {
        logger.error('Failed to load problem from bin file', { binFilePath, error });
        return undefined;
    }
}

/**
 * Recursively scans a folder for .bin files
 * @param folder URI of the folder to scan
 * @returns Promise that resolves to an array of .bin file paths
 */
export async function scanForBinFiles(folder: vscode.Uri): Promise<string[]> {
    logger.trace('scanForBinFiles', { folder });
    const binFiles: string[] = [];
    
    try {
        const entries = await vscode.workspace.fs.readDirectory(folder);
        for (const [name, type] of entries) {
            if (type === vscode.FileType.File && name.endsWith('.bin')) {
                binFiles.push(join(folder.fsPath, name));
            } else if (type === vscode.FileType.Directory) {
                // Recursively scan subdirectories
                const subFolder = vscode.Uri.joinPath(folder, name);
                const subBinFiles = await scanForBinFiles(subFolder);
                binFiles.push(...subBinFiles);
            }
        }
    } catch (error) {
        logger.error('Failed to scan directory for bin files', { folder, error });
    }
    
    return binFiles;
}
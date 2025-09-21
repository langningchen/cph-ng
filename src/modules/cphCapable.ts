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

import { enc, MD5 } from 'crypto-js';
import { readFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import * as vscode from 'vscode';
import { version } from '../../package.json';
import FolderChooser from '../helpers/folderChooser';
import Io from '../helpers/io';
import Logger from '../helpers/logger';
import { Problem } from '../utils/types';
import CphNg from './cphNg';
import { gunzipSync } from 'zlib';
import { migration, OldProblem } from '../utils/migration';

export interface CphProblem {
    name: string;
    url: string;
    tests: { id: number; input: string; output: string }[];
    interactive: boolean;
    memoryLimit: number;
    timeLimit: number;
    srcPath: string;
    group: string;
    local: boolean;
}

export default class CphCapable {
    private static logger: Logger = new Logger('cphCapable');

    public static getProbByCpp(cppFile: string): string {
        this.logger.trace('getProbByCpp', { cppFile });
        const probPath = join(
            dirname(cppFile),
            '.cph',
            `.${basename(cppFile)}_${MD5(cppFile).toString(enc.Hex)}.prob`,
        );
        this.logger.debug('Generated problem file path', { probPath });
        return probPath;
    }

    public static toProblem(cphProblem: CphProblem): Problem {
        this.logger.trace('toProblem', { cphProblem });
        const problem = {
            version,
            name: cphProblem.name,
            url: cphProblem.url,
            tcs: cphProblem.tests.map((test) => ({
                stdin: { useFile: false, data: test.input },
                answer: { useFile: false, data: test.output },
                isExpand: false,
            })),
            timeLimit: cphProblem.timeLimit,
            src: { path: cphProblem.srcPath },
        } satisfies Problem;
        this.logger.info('Converted CphProblem to Problem', { problem });
        return problem;
    }

    public static async loadProblem(
        probFile: string,
    ): Promise<Problem | undefined> {
        this.logger.trace('loadProblem', { probFile });
        try {
            const problem = CphCapable.toProblem(
                JSON.parse(
                    await readFile(probFile, 'utf-8'),
                ) satisfies CphProblem,
            );
            this.logger.debug('Loaded problem from file', {
                probFile,
                problem,
            });
            return problem;
        } catch (e) {
            this.logger.error('Failed to load problem', e);
            return undefined;
        }
    }

    public static async importFromCph(): Promise<void> {
        this.logger.trace('importFromCph');
        const uri = await FolderChooser.chooseFolder(
            vscode.l10n.t(
                'Please select the .cph folder contains the problem files',
            ),
        );
        if (!uri) {
            this.logger.info('No folder selected, aborting import');
            return;
        }
        this.logger.info('Selected folder for import', { uri });
        const probFiles = await vscode.workspace.fs.readDirectory(uri);
        this.logger.debug('Read directory contents', { probFiles });
        const problems: Problem[] = [];
        for (const [name, type] of probFiles) {
            if (type === vscode.FileType.File && name.endsWith('.prob')) {
                const probFilePath = join(uri.fsPath, name);
                const problem = await this.loadProblem(probFilePath);
                if (problem) {
                    problems.push(problem);
                    this.logger.info('Imported problem', { probFilePath });
                } else {
                    this.logger.warn('Failed to import problem', {
                        probFilePath,
                    });
                }
            }
        }
        if (problems.length === 0) {
            Io.info(
                vscode.l10n.t('No problem files found in the selected folder.'),
            );
            return;
        }
        const chosenIdx = await vscode.window.showQuickPick(
            problems.map((p, idx) => ({
                label: p.name,
                description: [
                    vscode.l10n.t('Number of test cases: {cnt}', {
                        cnt: p.tcs.length,
                    }),
                    p.checker ? vscode.l10n.t('Special Judge') : '',
                    p.interactor ? vscode.l10n.t('Interactive') : '',
                    p.bfCompare ? vscode.l10n.t('Brute Force Comparison') : '',
                ]
                    .join(' ')
                    .trim(),
                detail: p.url,
                picked: true,
                value: idx,
            })),
            {
                canPickMany: true,
                title: vscode.l10n.t('Select problems to import'),
            },
        );
        if (!chosenIdx || chosenIdx.length === 0) {
            this.logger.info('No problems selected for import, aborting');
            return;
        }
        this.logger.info('Selected problems for import', { chosenIdx });
        const selectedProblems = chosenIdx.map((idx) => problems[idx.value]);
        for (const problem of selectedProblems) {
            await CphNg.saveProblem(problem);
        }
    }

    private static async scanForBinFiles(folder: vscode.Uri): Promise<string[]> {
        this.logger.trace('scanForBinFiles', { folder });
        const binFiles: string[] = [];
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(folder);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && name.endsWith('.bin')) {
                    binFiles.push(join(folder.fsPath, name));
                } else if (type === vscode.FileType.Directory) {
                    // Recursively scan subdirectories
                    const subFolder = vscode.Uri.joinPath(folder, name);
                    const subBinFiles = await this.scanForBinFiles(subFolder);
                    binFiles.push(...subBinFiles);
                }
            }
        } catch (error) {
            this.logger.error('Failed to scan directory for bin files', { folder, error });
        }
        
        return binFiles;
    }

    private static async loadCphNgProblem(binFilePath: string): Promise<Problem | undefined> {
        this.logger.trace('loadCphNgProblem', { binFilePath });
        try {
            const data = await readFile(binFilePath);
            const problem = migration(
                JSON.parse(
                    gunzipSync(data).toString(),
                ) satisfies OldProblem,
            );
            this.logger.debug('Loaded CPH-NG problem from bin file', {
                binFilePath,
                problem,
            });
            return problem;
        } catch (error) {
            this.logger.error('Failed to load CPH-NG problem', { binFilePath, error });
            return undefined;
        }
    }

    public static async migrateFromCph(): Promise<void> {
        this.logger.trace('migrateFromCph');
        
        // Get the current workspace folder
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0];
        if (!currentWorkspace) {
            Io.error(vscode.l10n.t('No workspace folder is open.'));
            return;
        }

        // Select the source CPH-NG folder
        const sourceCphNgFolder = await FolderChooser.chooseFolder(
            vscode.l10n.t(
                'Select the source .cph-ng folder to migrate from',
            ),
        );
        if (!sourceCphNgFolder) {
            this.logger.info('No source folder selected, aborting migration');
            return;
        }

        // Select the target folder within current workspace
        const targetFolder = await FolderChooser.chooseFolder(
            vscode.l10n.t(
                'Select the target folder in current workspace to migrate to',
            ),
        );
        if (!targetFolder) {
            this.logger.info('No target folder selected, aborting migration');
            return;
        }

        this.logger.info('Starting migration', { 
            sourceCphNgFolder: sourceCphNgFolder.fsPath, 
            targetFolder: targetFolder.fsPath 
        });

        // Recursively scan the .cph-ng folder structure for .bin files
        const binFiles = await this.scanForBinFiles(sourceCphNgFolder);
        this.logger.debug('Found bin files', { binFiles });
        
        const problems: Problem[] = [];
        const migrationInfo: { original: Problem; migrated: Problem }[] = [];

        for (const binFilePath of binFiles) {
            const originalProblem = await this.loadCphNgProblem(binFilePath);
            if (originalProblem) {
                // Create a migrated version with updated paths
                const originalSrcPath = originalProblem.src.path;
                const srcFileName = basename(originalSrcPath);
                const newSrcPath = join(targetFolder.fsPath, srcFileName);
                
                const migratedProblem: Problem = {
                    ...originalProblem,
                    src: { 
                        path: newSrcPath,
                        hash: originalProblem.src.hash 
                    }
                };

                // If there are checker/interactor files, migrate them too
                if (originalProblem.checker) {
                    const checkerFileName = basename(originalProblem.checker.path);
                    migratedProblem.checker = {
                        path: join(targetFolder.fsPath, checkerFileName),
                        hash: originalProblem.checker.hash
                    };
                }

                if (originalProblem.interactor) {
                    const interactorFileName = basename(originalProblem.interactor.path);
                    migratedProblem.interactor = {
                        path: join(targetFolder.fsPath, interactorFileName),
                        hash: originalProblem.interactor.hash
                    };
                }

                if (originalProblem.bfCompare?.generator) {
                    const generatorFileName = basename(originalProblem.bfCompare.generator.path);
                    migratedProblem.bfCompare = {
                        ...originalProblem.bfCompare,
                        generator: {
                            path: join(targetFolder.fsPath, generatorFileName),
                            hash: originalProblem.bfCompare.generator.hash
                        }
                    };
                }

                if (originalProblem.bfCompare?.bruteForce) {
                    const bruteForceFileName = basename(originalProblem.bfCompare.bruteForce.path);
                    if (!migratedProblem.bfCompare) {
                        migratedProblem.bfCompare = { ...originalProblem.bfCompare };
                    }
                    migratedProblem.bfCompare.bruteForce = {
                        path: join(targetFolder.fsPath, bruteForceFileName),
                        hash: originalProblem.bfCompare.bruteForce.hash
                    };
                }

                problems.push(migratedProblem);
                migrationInfo.push({ original: originalProblem, migrated: migratedProblem });
                this.logger.info('Prepared problem for migration', { 
                    binFilePath,
                    originalSrcPath,
                    newSrcPath
                });
            } else {
                this.logger.warn('Failed to load problem for migration', {
                    binFilePath,
                });
            }
        }

        if (problems.length === 0) {
            Io.info(
                vscode.l10n.t('No problem files found in the selected folder.'),
            );
            return;
        }

        // Show migration preview to user
        const chosenIdx = await vscode.window.showQuickPick(
            problems.map((p, idx) => {
                const info = migrationInfo[idx];
                return {
                    label: p.name,
                    description: [
                        vscode.l10n.t('Number of test cases: {cnt}', {
                            cnt: p.tcs.length,
                        }),
                        p.checker ? vscode.l10n.t('Special Judge') : '',
                        p.interactor ? vscode.l10n.t('Interactive') : '',
                        p.bfCompare ? vscode.l10n.t('Brute Force Comparison') : '',
                    ]
                        .join(' ')
                        .trim(),
                    detail: `${basename(info.original.src.path)} → ${basename(info.migrated.src.path)}`,
                    picked: true,
                    value: idx,
                };
            }),
            {
                canPickMany: true,
                title: vscode.l10n.t('Select problems to migrate (paths will be updated)'),
            },
        );

        if (!chosenIdx || chosenIdx.length === 0) {
            this.logger.info('No problems selected for migration, aborting');
            return;
        }

        this.logger.info('Selected problems for migration', { chosenIdx });
        const selectedProblems = chosenIdx.map((idx) => problems[idx.value]);
        let migratedCount = 0;

        for (const problem of selectedProblems) {
            try {
                await CphNg.saveProblem(problem);
                migratedCount++;
                this.logger.info('Successfully migrated problem', { 
                    problemName: problem.name,
                    srcPath: problem.src.path
                });
            } catch (error) {
                this.logger.error('Failed to migrate problem', { 
                    problemName: problem.name,
                    error
                });
                Io.warn(
                    vscode.l10n.t('Failed to migrate problem: {name}', {
                        name: problem.name,
                    }),
                );
            }
        }

        Io.info(
            vscode.l10n.t('Migration completed. {count} problems migrated successfully.', {
                count: migratedCount,
            }),
        );
    }
}

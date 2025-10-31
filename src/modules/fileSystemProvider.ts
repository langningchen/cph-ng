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
import * as vscode from 'vscode';
import { Problem } from '../utils/types';
import { write2TcIo } from '../utils/types.backend';
import ProblemsManager from './problemsManager';

export type UriTypes = 'stdin' | 'answer' | 'stdout' | 'stderr';
export const generateTcUri = (problem: Problem, idx: number, type: UriTypes) =>
    vscode.Uri.from({
        scheme: FileSystemProvider.scheme,
        authority: problem.src.path,
        path: `/tcs/${idx}/${type}`,
    });

type CphFsFile = {
    data: string | vscode.Uri;
    set: (data: string) => Promise<void>;
};
type CphFsDirItem = [string, CphFsItem];
type CphFsDir = CphFsDirItem[];
type CphFsItem = CphFsFile | CphFsDir;

export class FileSystemProvider implements vscode.FileSystemProvider {
    public static readonly scheme = 'cph-ng';

    private notFound = vscode.FileSystemError.FileNotFound();
    private noPermissions = vscode.FileSystemError.NoPermissions();
    private isFile = vscode.FileSystemError.FileNotADirectory();
    private isDir = vscode.FileSystemError.FileIsADirectory();

    public changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
        this.changeEmitter.event;

    async parseUri(uri: vscode.Uri): Promise<CphFsItem> {
        const fullProblem = await ProblemsManager.getFullProblem(uri.authority);
        if (!fullProblem) {
            throw this.notFound;
        }
        const problem = fullProblem.problem;
        const path = uri.path.split('/').slice(1);
        if (path[0] === '') {
            path.length = 0;
        }
        let current: CphFsItem = [
            [
                'problem.cph-ng.json',
                {
                    data: JSON.stringify(problem, null, 4),
                    set: async (data: string) => {
                        const newProblem = JSON.parse(data);
                        Object.assign(problem, newProblem);
                        await ProblemsManager.dataRefresh();
                    },
                },
            ],
            [
                'tcs',
                problem.tcs.map((tc, idx): [string, CphFsItem] => {
                    const items: CphFsDir = [
                        [
                            'stdin',
                            {
                                data: tc.stdin.useFile
                                    ? vscode.Uri.file(tc.stdin.path)
                                    : tc.stdin.data,
                                set: async (data: string) => {
                                    tc.stdin = await write2TcIo(tc.stdin, data);
                                },
                            },
                        ],
                        [
                            'answer',
                            {
                                data: tc.answer.useFile
                                    ? vscode.Uri.file(tc.answer.path)
                                    : tc.answer.data,
                                set: async (data: string) => {
                                    tc.answer = await write2TcIo(
                                        tc.answer,
                                        data,
                                    );
                                },
                            },
                        ],
                    ];
                    if (tc.result) {
                        items.push([
                            'stdout',
                            {
                                data: tc.result.stdout.useFile
                                    ? vscode.Uri.file(tc.result.stdout.path)
                                    : tc.result.stdout.data,
                                set: async (data: string) => {
                                    if (!tc.result) {
                                        throw this.notFound;
                                    }
                                    tc.result.stdout = await write2TcIo(
                                        tc.result!.stdout,
                                        data,
                                    );
                                },
                            },
                        ]);
                        items.push([
                            'stderr',
                            {
                                data: tc.result.stderr.useFile
                                    ? vscode.Uri.file(tc.result.stderr.path)
                                    : tc.result.stderr.data,
                                set: async (data: string) => {
                                    if (!tc.result) {
                                        throw this.notFound;
                                    }
                                    tc.result.stderr = await write2TcIo(
                                        tc.result!.stderr,
                                        data,
                                    );
                                },
                            },
                        ]);
                    }
                    return [idx.toString(), items];
                }),
            ],
        ];
        for (const part of path) {
            if (Array.isArray(current)) {
                const next: CphFsDirItem | undefined = current.find(
                    ([name]) => name === part,
                );
                if (!next) {
                    throw this.notFound;
                }
                current = next[1];
            } else {
                throw this.notFound;
            }
        }
        return current;
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const item = await this.parseUri(uri);
        if (Array.isArray(item)) {
            return {
                type: vscode.FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0,
            };
        } else if (item.data instanceof vscode.Uri) {
            return {
                type: vscode.FileType.File | vscode.FileType.SymbolicLink,
                ctime: 0,
                mtime: 0,
                size: 0,
            };
        } else {
            return {
                type: vscode.FileType.File,
                ctime: 0,
                mtime: 0,
                size: item.data.length,
            };
        }
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const item = await this.parseUri(uri);
        if (Array.isArray(item)) {
            throw this.isDir;
        } else if (item.data instanceof vscode.Uri) {
            return await readFile(item.data.fsPath);
        } else {
            return Buffer.from(item.data);
        }
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
        const item = await this.parseUri(uri);
        if (Array.isArray(item)) {
            throw this.isDir;
        }
        await item.set(content.toString());
        this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        await ProblemsManager.dataRefresh();
    }

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }
    delete(): void {
        throw this.noPermissions;
    }
    rename(): void {
        throw this.noPermissions;
    }
    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const item = await this.parseUri(uri);
        if (!Array.isArray(item)) {
            throw this.isFile;
        }
        return item.map(([name, child]) => [
            name,
            Array.isArray(child)
                ? vscode.FileType.Directory
                : vscode.FileType.File,
        ]);
    }
    createDirectory(): void {
        throw this.noPermissions;
    }
}

export default FileSystemProvider;

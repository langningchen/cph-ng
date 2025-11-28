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

import { Problem } from '@/types';
import { UUID } from 'crypto';
import { readFile } from 'fs/promises';
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileChangeType,
  FilePermission,
  FileStat,
  FileSystemError,
  FileSystemProvider,
  FileType,
  Uri,
} from 'vscode';
import ProblemsManager from './manager';

export type UriTypes = 'stdin' | 'answer' | 'stdout' | 'stderr';
export const generateTcUri = (problem: Problem, id: UUID, type: UriTypes) =>
  Uri.from({
    scheme: ProblemFs.scheme,
    authority: problem.src.path,
    path: `/tcs/${id}/${type}`,
  });

type CphFsFile = {
  data: string | Uri;
  set?: (data: string) => Promise<void>;
};
type CphFsDirItem = [string, CphFsItem];
type CphFsDir = CphFsDirItem[];
type CphFsItem = CphFsFile | CphFsDir;

export class ProblemFs implements FileSystemProvider {
  public static readonly scheme = 'cph-ng';

  private notFound = FileSystemError.FileNotFound();
  private noPermissions = FileSystemError.NoPermissions();
  private isFile = FileSystemError.FileNotADirectory();
  private isDir = FileSystemError.FileIsADirectory();

  public changeEmitter = new EventEmitter<FileChangeEvent[]>();
  onDidChangeFile: Event<FileChangeEvent[]> = this.changeEmitter.event;

  async parseUri(uri: Uri): Promise<CphFsItem> {
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
        Object.entries(problem.tcs).map(([id, tc]): [string, CphFsItem] => {
          const items: CphFsDir = [
            [
              'stdin',
              {
                data: tc.stdin.useFile
                  ? Uri.file(tc.stdin.data)
                  : tc.stdin.data,
                set: async (data: string) => {
                  tc.stdin.fromString(data);
                },
              },
            ],
            [
              'answer',
              {
                data: tc.answer.useFile
                  ? Uri.file(tc.answer.data)
                  : tc.answer.data,
                set: async (data: string) => {
                  tc.answer.fromString(data);
                },
              },
            ],
          ];
          if (tc.result) {
            items.push([
              'stdout',
              {
                data: tc.result.stdout.useFile
                  ? Uri.file(tc.result.stdout.data)
                  : tc.result.stdout.data,
              },
            ]);
            items.push([
              'stderr',
              {
                data: tc.result.stderr.useFile
                  ? Uri.file(tc.result.stderr.data)
                  : tc.result.stderr.data,
              },
            ]);
          }
          return [id, items];
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
  public async fireAuthorityChange(authority: string): Promise<void> {
    const fullProblem = await ProblemsManager.getFullProblem(authority);
    if (!fullProblem) {
      return;
    }
    const events: FileChangeEvent[] = [];
    const baseUri = Uri.from({
      scheme: ProblemFs.scheme,
      authority,
      path: '/',
    });
    events.push({
      type: FileChangeType.Changed,
      uri: baseUri,
    });
    events.push({
      type: FileChangeType.Changed,
      uri: Uri.joinPath(baseUri, 'problem.cph-ng.json'),
    });
    for (const [id, tc] of Object.entries(fullProblem.problem.tcs)) {
      events.push({
        type: FileChangeType.Changed,
        uri: Uri.joinPath(baseUri, 'tcs', id, 'stdin'),
      });
      events.push({
        type: FileChangeType.Changed,
        uri: Uri.joinPath(baseUri, 'tcs', id, 'answer'),
      });
      if (tc.result) {
        events.push({
          type: FileChangeType.Changed,
          uri: Uri.joinPath(baseUri, 'tcs', id, 'stdout'),
        });
        events.push({
          type: FileChangeType.Changed,
          uri: Uri.joinPath(baseUri, 'tcs', id, 'stderr'),
        });
      }
    }
    this.changeEmitter.fire(events);
  }

  async stat(uri: Uri): Promise<FileStat> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) {
      return {
        type: FileType.Directory,
        ctime: 0,
        mtime: Date.now(),
        size: 0,
        permissions: FilePermission.Readonly,
      };
    } else if (item.data instanceof Uri) {
      return {
        type: FileType.File | FileType.SymbolicLink,
        ctime: 0,
        mtime: Date.now(),
        size: 0,
        permissions: item.set ? undefined : FilePermission.Readonly,
      };
    } else {
      return {
        type: FileType.File,
        ctime: 0,
        mtime: Date.now(),
        size: item.data.length,
        permissions: item.set ? undefined : FilePermission.Readonly,
      };
    }
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) {
      throw this.isDir;
    } else if (item.data instanceof Uri) {
      return await readFile(item.data.fsPath);
    } else {
      return Buffer.from(item.data);
    }
  }

  async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) {
      throw this.isDir;
    }
    if (!item.set) {
      throw this.noPermissions;
    }
    await item.set(content.toString());
    this.changeEmitter.fire([{ type: FileChangeType.Changed, uri }]);
    await ProblemsManager.dataRefresh();
  }

  watch(): Disposable {
    return new Disposable(() => {});
  }
  delete(): void {
    throw this.noPermissions;
  }
  rename(): void {
    throw this.noPermissions;
  }
  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const item = await this.parseUri(uri);
    if (!Array.isArray(item)) {
      throw this.isFile;
    }
    return item.map(([name, child]) => [
      name,
      Array.isArray(child) ? FileType.Directory : FileType.File,
    ]);
  }
  createDirectory(): void {
    throw this.noPermissions;
  }
}

export default ProblemFs;

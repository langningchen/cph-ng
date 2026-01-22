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

import type { UUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import {
  Disposable,
  type Event,
  EventEmitter,
  type FileChangeEvent,
  FileChangeType,
  FilePermission,
  type FileStat,
  FileSystemError,
  FileType,
  Uri,
} from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ITcIoService } from '@/application/ports/problems/ITcIoService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import { TOKENS } from '@/composition/tokens';
import type { TcIo } from '@/domain/entities/tcIo';
import { ProblemMapper } from '@/infrastructure/problems/problemMapper';

type CphFsFile = {
  data: string | Uri;
  set?: (data: string) => Promise<void>;
};
type CphFsDirItem = [string, CphFsItem];
type CphFsDir = CphFsDirItem[];
type CphFsItem = CphFsFile | CphFsDir;

@injectable()
export class ProblemFs implements IProblemFs {
  public static readonly scheme = 'cph-ng';

  public changeEmitter = new EventEmitter<FileChangeEvent[]>();
  public onDidChangeFile: Event<FileChangeEvent[]> = this.changeEmitter.event;

  public constructor(
    @inject(ProblemMapper) private readonly mapper: ProblemMapper,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.tcIoService) private readonly tcIoService: ITcIoService,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {
    this.logger = this.logger.withScope('ProblemFs');
  }

  public getUri(problemId: UUID, path: string) {
    return Uri.from({ scheme: ProblemFs.scheme, authority: problemId, path });
  }

  public async parseUri(uri: Uri): Promise<CphFsItem> {
    const fullProblem = await this.repo.get(uri.authority as UUID);
    if (!fullProblem) throw FileSystemError.FileNotFound();
    const problem = fullProblem.problem;
    const pathParts = uri.path.split('/').filter((p) => p.length > 0);
    const tcIds = problem.getEnabledTcIds();
    const root: CphFsDir = [
      [
        'problem.cph-ng.json',
        {
          data: JSON.stringify(this.mapper.toDto(problem), null, 4),
          set: async (data: string) => {
            const newProblem = JSON.parse(data);
            fullProblem.problem = this.mapper.toEntity(newProblem);
            await this.coordinator.dispatchFullData();
          },
        },
      ],
      [
        'tcs',
        tcIds.map((tcId) => {
          const tc = problem.getTc(tcId);
          const tcIoToStringOrUri = (io: TcIo): string | Uri => {
            if (io.data) return io.data;
            if (io.path) return Uri.file(io.path);
            throw new Error('TcIo has neither data nor path');
          };
          const items: CphFsDir = [
            [
              'stdin',
              {
                data: tcIoToStringOrUri(tc.stdin),
                set: async (data: string) => {
                  tc.stdin = await this.tcIoService.writeContent(tc.stdin, data);
                },
              },
            ],
            [
              'answer',
              {
                data: tcIoToStringOrUri(tc.answer),
                set: async (data: string) => {
                  tc.answer = await this.tcIoService.writeContent(tc.answer, data);
                },
              },
            ],
          ];
          if (tc.stdout) items.push(['stdout', { data: tcIoToStringOrUri(tc.stdout) }]);
          if (tc.stderr) items.push(['stderr', { data: tcIoToStringOrUri(tc.stderr) }]);
          return [tcId, items];
        }),
      ],
    ];
    let current: CphFsItem = root;
    for (const part of pathParts) {
      if (Array.isArray(current)) {
        const next = current.find(([name]) => name === part) as CphFsDirItem | undefined;
        if (!next) throw FileSystemError.FileNotFound();
        current = next[1];
      } else throw FileSystemError.FileNotFound();
    }
    return current;
  }
  public async fireAuthorityChange(authority: UUID): Promise<void> {
    const fullProblem = await this.repo.get(authority);
    if (!fullProblem) return;
    const tcIds = fullProblem.problem.getEnabledTcIds();
    const baseUri = Uri.from({ scheme: ProblemFs.scheme, authority, path: '/' });

    const files: Uri[] = [];
    files.push(baseUri);
    files.push(Uri.joinPath(baseUri, 'problem.cph-ng.json'));
    for (const tcId of tcIds) {
      const tc = fullProblem.problem.getTc(tcId);
      files.push(Uri.joinPath(baseUri, 'tcs', tcId, 'stdin'));
      files.push(Uri.joinPath(baseUri, 'tcs', tcId, 'answer'));
      if (tc.stdout) files.push(Uri.joinPath(baseUri, 'tcs', tcId, 'stdout'));
      if (tc.stderr) files.push(Uri.joinPath(baseUri, 'tcs', tcId, 'stderr'));
    }
    this.changeEmitter.fire(files.map((uri) => ({ type: FileChangeType.Changed, uri })));
  }

  public async stat(uri: Uri): Promise<FileStat> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) {
      return {
        type: FileType.Directory,
        ctime: 0,
        mtime: Date.now(),
        size: 0,
        permissions: FilePermission.Readonly,
      };
    }
    if (item.data instanceof Uri) {
      return {
        type: FileType.File | FileType.SymbolicLink,
        ctime: 0,
        mtime: Date.now(),
        size: 0,
        permissions: item.set ? undefined : FilePermission.Readonly,
      };
    }
    return {
      type: FileType.File,
      ctime: 0,
      mtime: Date.now(),
      size: item.data.length,
      permissions: item.set ? undefined : FilePermission.Readonly,
    };
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) throw FileSystemError.FileIsADirectory();
    const data = item.data instanceof Uri ? await this.fs.readFile(item.data.fsPath) : item.data;
    return Buffer.from(data);
  }

  public async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    const item = await this.parseUri(uri);
    if (Array.isArray(item)) throw FileSystemError.FileIsADirectory();
    if (!item.set) throw FileSystemError.NoPermissions();
    await item.set(content.toString());
    this.changeEmitter.fire([{ type: FileChangeType.Changed, uri }]);
  }

  public watch(): Disposable {
    return new Disposable(() => {});
  }
  public delete(): void {
    throw FileSystemError.NoPermissions();
  }
  public rename(): void {
    throw FileSystemError.NoPermissions();
  }
  public async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const item = await this.parseUri(uri);
    if (!Array.isArray(item)) throw FileSystemError.FileNotADirectory();
    return item.map(([name, child]) => [
      name,
      Array.isArray(child)
        ? FileType.Directory
        : child.data instanceof Uri
          ? FileType.File | FileType.SymbolicLink
          : FileType.File,
    ]);
  }
  public createDirectory(): void {
    throw FileSystemError.NoPermissions();
  }
}

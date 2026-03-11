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

import { EventEmitter } from 'node:events';
import type { TestcaseId } from '@cph-ng/core';
import type { IFileSystem } from '@v/application/ports/node/IFileSystem';
import type { IPath } from '@v/application/ports/node/IPath';
import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import type { ITestcaseIoService } from '@v/application/ports/problems/ITestcaseIoService';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { IProblemFs } from '@v/application/ports/vscode/IProblemFs';
import { TOKENS } from '@v/composition/tokens';
import type { Testcase, TestcaseResult } from '@v/domain/entities/testcase';
import type { TestcaseIo } from '@v/domain/entities/testcaseIo';
import { ProblemMapper } from '@v/infrastructure/problems/problemMapper';
import { decode, encode } from 'hi-base32';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';
import {
  Disposable,
  type Event,
  type FileChangeEvent,
  FileChangeType,
  FilePermission,
  type FileStat,
  FileSystemError,
  FileType,
  Uri,
  EventEmitter as vsEventEmitter,
} from 'vscode';

type CphFsFile = {
  data: string | Uri;
  set?: (data: string) => Promise<void>;
};
type CphFsDirItem = [string, CphFsItem];
type CphFsDir = CphFsDirItem[];
type CphFsItem = CphFsFile | CphFsDir;

export type ProblemFsEvents = {
  problemFileChanged: () => void;
  patchProblem: (srcPath: string) => void;
  addTestcase: (srcPath: string, testcaseId: TestcaseId, payload: Testcase) => void;
  deleteTestcase: (srcPath: string, testcaseId: TestcaseId) => void;
  patchTestcase: (
    srcPath: string,
    testcaseId: TestcaseId,
    payload: Partial<Testcase | TestcaseResult>,
  ) => void;
};

@injectable()
export class ProblemFs implements IProblemFs {
  public readonly scheme = 'cph-ng';

  public readonly signals = new EventEmitter() as TypedEventEmitter<ProblemFsEvents>;
  private changeEmitter = new vsEventEmitter<FileChangeEvent[]>();
  public onDidChangeFile: Event<FileChangeEvent[]> = this.changeEmitter.event;

  public constructor(
    @inject(ProblemMapper) private readonly mapper: ProblemMapper,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
  ) {
    this.logger = this.logger.withScope('problemFs');

    this.signals.on('patchProblem', (srcPath: string) => {
      const baseUri = this.getUri(srcPath, '/');
      this.changeEmitter.fire([
        { uri: Uri.joinPath(baseUri, 'problem.cph-ng.json'), type: FileChangeType.Changed },
      ]);
    });
    this.signals.on('addTestcase', (srcPath: string, testcaseId: TestcaseId, payload: Testcase) => {
      const baseUri = this.getUri(srcPath, '/');
      const addedFiles = ['stdin', 'answer'];
      if (payload.result?.stdout) addedFiles.push('stdout');
      if (payload.result?.stderr) addedFiles.push('stderr');
      this.changeEmitter.fire([
        { uri: Uri.joinPath(baseUri, 'problem.cph-ng.json'), type: FileChangeType.Changed },
        ...addedFiles.map((type) => ({
          uri: Uri.joinPath(baseUri, 'testcases', testcaseId, type),
          type: FileChangeType.Created,
        })),
      ]);
    });
    this.signals.on('deleteTestcase', (srcPath: string, testcaseId: TestcaseId) => {
      const baseUri = this.getUri(srcPath, '/');
      const deletedFiles = ['stdin', 'answer', 'stdout', 'stderr'];
      this.changeEmitter.fire([
        { uri: Uri.joinPath(baseUri, 'problem.cph-ng.json'), type: FileChangeType.Changed },
        ...deletedFiles.map((type) => ({
          uri: Uri.joinPath(baseUri, 'testcases', testcaseId, type),
          type: FileChangeType.Deleted,
        })),
      ]);
    });
    this.signals.on(
      'patchTestcase',
      (srcPath: string, testcaseId: TestcaseId, payload: Partial<Testcase | TestcaseResult>) => {
        const baseUri = this.getUri(srcPath, '/');
        const changedFiles = [];
        if ('stdin' in payload && payload.stdin) changedFiles.push('stdin');
        if ('answer' in payload && payload.answer) changedFiles.push('answer');
        if ('stdout' in payload && payload.stdout) changedFiles.push('stdout');
        if ('stderr' in payload && payload.stderr) changedFiles.push('stderr');
        const problemUri = Uri.joinPath(baseUri, 'problem.cph-ng.json');
        this.changeEmitter.fire([
          { uri: problemUri, type: FileChangeType.Changed },
          ...changedFiles.map((type) => ({
            uri: Uri.joinPath(baseUri, 'testcases', testcaseId, type),
            type: FileChangeType.Changed,
          })),
        ]);
      },
    );
  }

  public getUri(srcPath: string, path: string) {
    const authority = encode(srcPath).replaceAll('=', '');
    const base = Uri.from({ scheme: this.scheme, authority, path: '/' });
    return Uri.joinPath(base, this.path.basename(srcPath), path);
  }
  private parseUri(uri: Uri): { srcPath: string; path: string } {
    const srcPath = decode(uri.authority);
    const path = uri.path.substring(1 + this.path.basename(srcPath).length);
    return { srcPath, path };
  }

  private async getFile(uri: Uri): Promise<CphFsItem> {
    const { srcPath, path } = this.parseUri(uri);
    const backgroundProblem = await this.repo.loadByPath(srcPath);
    if (!backgroundProblem) throw FileSystemError.FileNotFound();
    const problem = backgroundProblem.problem;
    const pathParts = path.split('/').filter((p) => p.length > 0);
    const testcaseIds = problem.getEnabledTestcaseIds();
    const root: CphFsDir = [
      [
        'problem.cph-ng.json',
        {
          data: JSON.stringify(this.mapper.toDto(problem), null, 4),
          set: async (data: string) => {
            const newProblem = JSON.parse(data);
            backgroundProblem.problem = this.mapper.toEntity(newProblem);
            this.signals.emit('problemFileChanged');
          },
        },
      ],
      [
        'testcases',
        testcaseIds.map((testcaseId) => {
          const testcase = problem.getTestcase(testcaseId);
          const testcaseIoToStringOrUri = (io: TestcaseIo): string | Uri => {
            if (io.data !== undefined) return io.data;
            if (io.path !== undefined) return Uri.file(io.path);
            throw new Error('TestcaseIo has neither data nor path');
          };
          const items: CphFsDir = [
            [
              'stdin',
              {
                data: testcaseIoToStringOrUri(testcase.stdin),
                set: async (data: string) => {
                  testcase.stdin = await this.testcaseIoService.writeContent(testcase.stdin, data);
                },
              },
            ],
            [
              'answer',
              {
                data: testcaseIoToStringOrUri(testcase.answer),
                set: async (data: string) => {
                  testcase.answer = await this.testcaseIoService.writeContent(
                    testcase.answer,
                    data,
                  );
                },
              },
            ],
          ];
          if (testcase.result?.stdout)
            items.push(['stdout', { data: testcaseIoToStringOrUri(testcase.result?.stdout) }]);
          if (testcase.result?.stderr)
            items.push(['stderr', { data: testcaseIoToStringOrUri(testcase.result?.stderr) }]);
          return [testcaseId, items];
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

  public async stat(uri: Uri): Promise<FileStat> {
    const item = await this.getFile(uri);
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
    const item = await this.getFile(uri);
    if (Array.isArray(item)) throw FileSystemError.FileIsADirectory();
    const data = item.data instanceof Uri ? await this.fs.readFile(item.data.fsPath) : item.data;
    return Buffer.from(data);
  }

  public async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    const item = await this.getFile(uri);
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
    const item = await this.getFile(uri);
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

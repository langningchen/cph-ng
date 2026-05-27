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

import { dirname, extname, isAbsolute, relative } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { IFileWithHash, IProblem, ITestcase, ITestcaseIo, TestcaseId } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  IProblemMigrationService,
  OldProblem,
} from '@/application/ports/problems/IProblemMigrationService';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import type { Testcase } from '@/domain/entities/testcase';
import { TestcaseScanner } from '@/domain/services/TestcaseScanner';
import { ProblemMapper } from '@/infrastructure/problems/problemMapper';

@injectable()
export class ProblemService implements IProblemService {
  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.problemMigrationService) private readonly migration: IProblemMigrationService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(ProblemMapper) private readonly mapper: ProblemMapper,
    @inject(TestcaseScanner) private readonly testcaseScanner: TestcaseScanner,
  ) {
    this.logger = this.logger.withScope('problemService');
  }

  public getDataPath(srcPath: string): string | null {
    return this.resolver.renderPathWithFile(this.settings.problem.problemFilePath, srcPath, true);
  }
  public getTestcasePath(srcPath: string, id: TestcaseId, ext: string): string | null {
    const result = this.resolver.renderPathWithFile(
      this.settings.problem.testcaseFilePath,
      srcPath,
    );
    if (!result) return null;
    return this.resolver.renderString(result, [
      ['id', id.substring(0, 8)],
      ['ext', ext],
    ]);
  }

  public async create(srcPath: string): Promise<Problem | null> {
    const binPath = this.getDataPath(srcPath);
    if (!binPath) return null;
    const problem = new Problem(this.path.basename(srcPath, this.path.extname(srcPath)), srcPath);
    await this.save(problem);
    return problem;
  }

  public async copy(problem: Problem, destSrcPath: string): Promise<Problem> {
    const oldBinPath = this.getDataPath(problem.src.path);
    const newBinPath = this.getDataPath(destSrcPath);
    if (!newBinPath) throw new Error(this.translator.t('Cannot resolve copied problem data path'));
    if (oldBinPath === newBinPath)
      throw new Error(this.translator.t('Copied problem data path conflicts with current problem'));
    if (await this.fs.exists(newBinPath))
      throw new Error(this.translator.t('Copied problem data path already exists'));

    const copiedPaths: string[] = [];
    try {
      await this.copyPath(problem.src.path, destSrcPath, copiedPaths);
      copiedPaths.push(newBinPath);

      const dto = this.mapper.toDto(problem);
      await this.copyProblemFiles(dto, destSrcPath, newBinPath, copiedPaths);
      dto.src = { ...dto.src, path: destSrcPath };
      dto.name = this.path.basename(destSrcPath, this.path.extname(destSrcPath));
      const copiedProblem = this.mapper.toEntity(dto);
      await this.save(copiedProblem);
      return copiedProblem;
    } catch (e) {
      await this.rollbackCopy(copiedPaths);
      throw e;
    }
  }

  private async copyProblemFiles(
    problem: IProblem,
    destSrcPath: string,
    newBinPath: string,
    copiedPaths: string[],
  ): Promise<void> {
    for (const [testcaseId, testcase] of Object.entries(problem.testcases)) {
      const id = testcaseId as TestcaseId;
      testcase.stdin = await this.copyTestcaseIo(
        testcase.stdin,
        destSrcPath,
        id,
        'in',
        copiedPaths,
      );
      testcase.answer = await this.copyTestcaseIo(
        testcase.answer,
        destSrcPath,
        id,
        'out',
        copiedPaths,
      );
      testcase.result = null;
    }
    problem.checker = await this.copyFileWithHash(
      problem.checker,
      destSrcPath,
      newBinPath,
      'checker',
      copiedPaths,
    );
    problem.interactor = await this.copyFileWithHash(
      problem.interactor,
      destSrcPath,
      newBinPath,
      'interactor',
      copiedPaths,
    );
    problem.stressTest.generator = await this.copyFileWithHash(
      problem.stressTest.generator,
      destSrcPath,
      newBinPath,
      'generator',
      copiedPaths,
    );
    problem.stressTest.bruteForce = await this.copyFileWithHash(
      problem.stressTest.bruteForce,
      destSrcPath,
      newBinPath,
      'bruteForce',
      copiedPaths,
    );
  }

  private async copyTestcaseIo(
    io: ITestcaseIo,
    destSrcPath: string,
    testcaseId: TestcaseId,
    fallbackExt: string,
    copiedPaths: string[],
  ): Promise<ITestcaseIo> {
    if (!('path' in io)) return { ...io };
    const ext = this.path.extname(io.path).substring(1) || fallbackExt;
    const destPath = this.getTestcasePath(destSrcPath, testcaseId, ext);
    if (!destPath) throw new Error(this.translator.t('Cannot resolve copied testcase path'));
    await this.copyPath(io.path, destPath, copiedPaths);
    return { path: destPath };
  }

  private async copyFileWithHash(
    file: IFileWithHash | null,
    destSrcPath: string,
    newBinPath: string,
    role: string,
    copiedPaths: string[],
  ): Promise<IFileWithHash | null> {
    if (!file) return null;
    const destPath = this.getAuxiliaryCopyPath(destSrcPath, newBinPath, role, file.path);
    await this.copyPath(file.path, destPath, copiedPaths);
    return { ...file, path: destPath };
  }

  private getAuxiliaryCopyPath(
    destSrcPath: string,
    newBinPath: string,
    role: string,
    oldPath: string,
  ): string {
    const destBaseName = this.path.basename(destSrcPath, this.path.extname(destSrcPath));
    return this.path.join(
      this.path.dirname(newBinPath),
      `${destBaseName}.${role}${this.path.extname(oldPath)}`,
    );
  }

  private async copyPath(srcPath: string, destPath: string, copiedPaths: string[]): Promise<void> {
    if (await this.fs.exists(destPath))
      throw new Error(this.translator.t('Copied problem file path already exists'));
    await this.fs.copyFile(srcPath, destPath);
    copiedPaths.push(destPath);
  }

  private async rollbackCopy(paths: string[]): Promise<void> {
    await Promise.all(
      [...paths].reverse().map((path) => this.fs.rm(path, { force: true }).catch(() => {})),
    );
  }

  public async loadBySrc(srcPath: string): Promise<Problem | null> {
    const binPath = this.getDataPath(srcPath);
    if (!binPath) return null;

    let data: Buffer<ArrayBuffer>;
    try {
      data = await this.fs.readRawFile(binPath);
    } catch {
      return null;
    }

    let oldProblem: OldProblem;
    try {
      oldProblem = JSON.parse(gunzipSync(data).toString());
    } catch (e) {
      this.telemetry.error('loadProblemError', e);
      throw e;
    }

    // Migrate old problem data to the latest version
    const problem = this.migration.migrate(oldProblem);
    await this.fixMovedPaths(problem, srcPath);

    this.logger.info('Problem', problem.src.path, 'loaded');
    this.logger.trace('Loaded problem data', { problem });
    return this.mapper.toEntity(problem);
  }

  public async loadTestcases(problem: Problem, file: boolean): Promise<void> {
    const path = await this.ui.openDialog({
      title: file
        ? this.translator.t('Choose a zip file containing test cases')
        : this.translator.t('Choose a folder containing test cases'),
      canSelectFiles: file,
      canSelectFolders: !file,
    });
    if (!path) return;
    const testcases = file
      ? await this.testcaseScanner.fromZip(problem.src.path, path)
      : await this.testcaseScanner.fromFolder(path);
    this.applyTestcases(problem, testcases);
  }

  public applyTestcases(problem: Problem, testcases: Testcase[]): void {
    if (this.settings.problem.clearBeforeLoad) this.tmp.dispose(problem.clearTestcases());
    for (const testcase of testcases) {
      const testcaseId = this.crypto.randomUUID() as TestcaseId;
      problem.addTestcase(testcaseId, testcase);
    }
  }

  public async save(problem: Problem): Promise<void> {
    const binPath = this.getDataPath(problem.src.path);
    if (!binPath) return;
    this.tmp.dispose(problem.purgeUnusedTestcases());

    const problemDto = this.mapper.toDto(problem);
    this.logger.trace('Saving problem data', problemDto, 'to', binPath);
    try {
      await this.fs.safeWriteFile(binPath, gzipSync(Buffer.from(JSON.stringify(problemDto))));
      this.logger.info('Saved problem', problem.src.path);
    } catch (e) {
      this.telemetry.error('saveError', e, {
        problem: JSON.stringify(problemDto),
      });
      throw e;
    }
  }

  public async delete(problem: Problem): Promise<void> {
    const binPath = this.getDataPath(problem.src.path);
    if (!binPath) return;
    const paths = this.getOwnedProblemPaths(problem, binPath);
    try {
      await Promise.all(paths.map((path) => this.fs.rm(path, { force: true })));
      this.logger.info('Deleted problem', problem.src.path);
    } catch (e) {
      this.telemetry.error('deleteError', e);
      throw e;
    }
  }

  private getOwnedProblemPaths(problem: Problem, binPath: string): string[] {
    const paths = new Set<string>([binPath, problem.src.path]);
    const dataDir = this.path.dirname(binPath);
    const addDataFile = (path: string) => {
      if (this.isInsideDirectory(path, dataDir)) paths.add(path);
    };

    for (const testcase of problem.testcases.values())
      for (const path of testcase.getDisposables()) addDataFile(path);
    if (problem.checker) addDataFile(problem.checker.path);
    if (problem.interactor) addDataFile(problem.interactor.path);
    if (problem.stressTest.generator) addDataFile(problem.stressTest.generator.path);
    if (problem.stressTest.bruteForce) addDataFile(problem.stressTest.bruteForce.path);
    return [...paths];
  }

  private isInsideDirectory(path: string, directory: string): boolean {
    const relativePath = this.path.relative(directory, path);
    return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
  }

  public isRelated(problem: Problem, path: string): boolean {
    if (!path) return false;

    // We always consider the IO files related to the problem
    const ext = extname(path).toLowerCase();
    if (
      this.settings.problem.inputFileExtensionList.includes(ext) ||
      this.settings.problem.outputFileExtensionList.includes(ext) ||
      path.startsWith(this.resolver.renderPath(this.settings.cache.directory)) ||
      problem.isRelated(path)
    )
      return true;
    return false;
  }

  private async fixMovedPaths(problem: IProblem, newSrcPath: string) {
    // When the user moves the workspace
    // we need to fix the paths in the problem data

    const fix = async (oldPath: string): Promise<string> => {
      if (await this.fs.exists(oldPath)) return oldPath;
      // Use the relative path from the old path to the src file
      // and join it with the new src file path
      const newPath = this.path.resolve(
        this.path.dirname(newSrcPath),
        relative(dirname(problem.src.path), oldPath),
      );
      if (await this.fs.exists(newPath)) {
        this.logger.debug('Fixed path', oldPath, 'to', newPath);
        return newPath;
      }
      return oldPath;
    };
    const fixTestcaseIo = async (testcaseIo: ITestcaseIo) => {
      if ('path' in testcaseIo) testcaseIo.path = await fix(testcaseIo.path);
    };
    const fixFileWithHash = async (fileWithHash: IFileWithHash | null) => {
      if (fileWithHash) fileWithHash.path = await fix(fileWithHash.path);
    };

    await Promise.all([
      ...Object.values(problem.testcases).flatMap((testcase: ITestcase) => [
        fixTestcaseIo(testcase.stdin),
        fixTestcaseIo(testcase.answer),
      ]),
      fixFileWithHash(problem.checker),
      fixFileWithHash(problem.interactor),
      fixFileWithHash(problem.stressTest.generator),
      fixFileWithHash(problem.stressTest.bruteForce),
    ]);
    problem.src.path = newSrcPath;
  }

  public getLimits(problem: Problem) {
    return {
      timeLimitMs: problem.overrides?.timeLimitMs ?? this.settings.problem.defaultTimeLimit,
      memoryLimitMb: problem.overrides?.memoryLimitMb ?? this.settings.problem.defaultMemoryLimit,
    };
  }
}

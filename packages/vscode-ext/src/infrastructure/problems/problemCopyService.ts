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

import type { IFileWithHash, IProblem, ITestcaseIo, TestcaseId } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProblemCopyService } from '@/application/ports/problems/IProblemCopyService';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';
import { ProblemMapper } from '@/infrastructure/problems/problemMapper';

@injectable()
export class ProblemCopyService implements IProblemCopyService {
  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(ProblemMapper) private readonly mapper: ProblemMapper,
  ) {}

  public async copy(problem: Problem, destSrcPath: string): Promise<Problem> {
    const oldBinPath = this.problemService.getDataPath(problem.src.path);
    const newBinPath = this.problemService.getDataPath(destSrcPath);
    if (!newBinPath) throw new Error(this.translator.t('Cannot resolve copied problem data path'));
    if (oldBinPath === newBinPath)
      throw new Error(this.translator.t('Copied problem data path conflicts with current problem'));
    if (await this.fs.exists(newBinPath))
      throw new Error(this.translator.t('Copied problem data path already exists'));
    await this.removeOrphanedCopiedFiles(problem, destSrcPath, newBinPath);

    const copiedPaths: string[] = [];
    try {
      await this.copyPath(problem.src.path, destSrcPath, copiedPaths);
      copiedPaths.push(newBinPath);

      const dto = this.mapper.toDto(problem);
      await this.copyProblemFiles(dto, destSrcPath, newBinPath, copiedPaths);
      dto.src = { ...dto.src, path: destSrcPath };
      dto.name = this.path.basename(destSrcPath, this.path.extname(destSrcPath));
      const copiedProblem = this.mapper.toEntity(dto);
      await this.problemService.save(copiedProblem);
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

  private async removeOrphanedCopiedFiles(
    problem: Problem,
    destSrcPath: string,
    newBinPath: string,
  ): Promise<void> {
    if (await this.fs.exists(destSrcPath)) return;
    const dto = this.mapper.toDto(problem);
    const paths = this.getCopiedProblemFilePaths(dto, destSrcPath, newBinPath);
    await Promise.all(paths.map((path) => this.fs.rm(path, { force: true }).catch(() => {})));
  }

  private getCopiedProblemFilePaths(
    problem: IProblem,
    destSrcPath: string,
    newBinPath: string,
  ): string[] {
    const paths: string[] = [];
    for (const [testcaseId, testcase] of Object.entries(problem.testcases)) {
      const id = testcaseId as TestcaseId;
      for (const [io, fallbackExt] of [
        [testcase.stdin, 'in'],
        [testcase.answer, 'out'],
      ] as const) {
        if (!('path' in io)) continue;
        const ext = this.path.extname(io.path).substring(1) || fallbackExt;
        const destPath = this.problemService.getTestcasePath(destSrcPath, id, ext);
        if (destPath) paths.push(destPath);
      }
    }
    for (const [file, role] of [
      [problem.checker, 'checker'],
      [problem.interactor, 'interactor'],
      [problem.stressTest.generator, 'generator'],
      [problem.stressTest.bruteForce, 'bruteForce'],
    ] as const)
      if (file) paths.push(this.getAuxiliaryCopyPath(destSrcPath, newBinPath, role, file.path));
    return paths;
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
    const destPath = this.problemService.getTestcasePath(destSrcPath, testcaseId, ext);
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
}

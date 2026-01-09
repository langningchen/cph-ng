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

import { dirname, extname, relative } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { Tc } from '@/domain/entities/tc';
import {
  type IFileWithHash,
  type IProblem,
  type ITc,
  type ITcIo,
  migration,
  type OldProblem,
} from '@/types';

@injectable()
export class ProblemService implements IProblemService {
  constructor(
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Path) private readonly path: IPath,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.Crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.PathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Telemetry) private readonly telemetry: ITelemetry,
    @inject(TOKENS.ProblemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
  ) {
    this.logger = this.logger.withScope('ProblemRepository');
  }

  public async loadBySrc(srcPath: string): Promise<Problem | null> {
    const binPath = this.repo.getDataPath(srcPath);
    if (!binPath) return null;

    var data = await this.fs.readFile(binPath);

    var oldProblem: OldProblem;
    try {
      oldProblem = JSON.parse(gunzipSync(data).toString());
    } catch (e) {
      this.telemetry.error('loadProblemError', e);
      throw e;
    }

    // Migrate old problem data to the latest version
    var problem = migration(oldProblem);
    await this.fixMovedPaths(problem, srcPath);

    this.logger.info('Problem', problem.src.path, 'loaded');
    this.logger.trace('Loaded problem data', { problem });
    return Problem.fromI(problem);
  }

  public applyTcs(problem: Problem, tcs: ITc[]): void {
    if (this.settings.problem.clearBeforeLoad) problem.clearTcs();
    for (const tc of tcs) problem.addTc(this.crypto.randomUUID(), Tc.fromI(tc));
  }

  public async save(problem: Problem): Promise<void> {
    const binPath = this.repo.getDataPath(problem.src.path);
    if (!binPath) return;
    this.logger.trace('Saving problem data', this, 'to', binPath);

    this.tmp.dispose(problem.purgeUnusedTcs());

    try {
      await this.fs.safeWriteFile(binPath, gzipSync(Buffer.from(JSON.stringify(this))));
      this.logger.info('Saved problem', problem.src.path);
    } catch (e) {
      this.telemetry.error('saveError', e, {
        problem: JSON.stringify(this),
      });
      throw e;
    }
  }

  public async delete(problem: Problem): Promise<void> {
    const binPath = this.repo.getDataPath(problem.src.path);
    if (!binPath) return;
    try {
      await this.fs.rm(binPath);
      this.logger.info('Deleted problem', problem.src.path);
    } catch (e) {
      this.telemetry.error('deleteError', e);
      throw e;
    }
  }

  public isRelated(problem: Problem, path: string): boolean {
    if (!path) return false;
    path = path.toLowerCase();

    // We always consider the IO files related to the problem
    if (
      this.settings.problem.inputFileExtensionList.includes(extname(path)) ||
      this.settings.problem.outputFileExtensionList.includes(extname(path)) ||
      path.startsWith(this.resolver.renderPath(this.settings.cache.directory).toLowerCase()) ||
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
    const fixTcIo = async (tcIo: ITcIo) => {
      if (tcIo.useFile) tcIo.data = await fix(tcIo.data);
    };
    const fixFileWithHash = async (fileWithHash?: IFileWithHash) => {
      if (fileWithHash) fileWithHash.path = await fix(fileWithHash.path);
    };

    for (const tc of Object.values(problem.tcs)) {
      fixTcIo(tc.stdin);
      fixTcIo(tc.answer);
    }
    fixFileWithHash(problem.checker);
    fixFileWithHash(problem.interactor);
    fixFileWithHash(problem.bfCompare?.generator);
    fixFileWithHash(problem.bfCompare?.bruteForce);
    problem.src.path = newSrcPath;
  }

  public getLimits(problem: Problem) {
    return {
      timeLimitMs: problem.overrides?.timeLimitMs ?? this.settings.problem.defaultTimeLimit,
      memoryLimitMb: problem.overrides?.memoryLimitMb ?? this.settings.problem.defaultMemoryLimit,
    };
  }
}

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

import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { ICphProblem } from '@/domain/types';

@injectable()
export class CphMigrationService implements ICphMigrationService {
  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.path) private readonly path: IPath,
  ) {
    this.logger = this.logger.withScope('CphMigration');
  }

  public async canMigrate(srcPath: string): Promise<boolean> {
    const probPath = this.getProbFilePath(srcPath);
    return await this.fs.exists(probPath);
  }

  public async migrateFromSource(srcPath: string): Promise<Problem | undefined> {
    const probPath = this.getProbFilePath(srcPath);
    if (!(await this.fs.exists(probPath))) return undefined;
    return this.loadProbFile(probPath);
  }

  public async migrateFolder(folderPath: string): Promise<Problem[]> {
    const entries = await this.fs.readdir(folderPath);
    const problems: Problem[] = [];
    for (const [name, type] of entries)
      if (type === 'file' && name.endsWith('.prob')) {
        const p = await this.loadProbFile(this.path.resolve(folderPath, name));
        if (p) problems.push(p);
      }
    return problems;
  }

  private async loadProbFile(probPath: string): Promise<Problem | undefined> {
    try {
      const content = await this.fs.readFile(probPath, 'utf-8');
      const data = JSON.parse(content) as ICphProblem;
      return this.convertToDomain(data);
    } catch (e) {
      this.logger.error(`Failed to read CPH problem file: ${probPath}`, e);
      return undefined;
    }
  }

  private convertToDomain(old: ICphProblem): Problem {
    const problem = new Problem(old.name, old.srcPath);
    problem.url = old.url;
    problem.overrides.timeLimitMs = old.timeLimit;
    problem.overrides.memoryLimitMb = old.memoryLimit;
    old.tests.forEach((test) => {
      problem.addTestcase(
        this.crypto.randomUUID(),
        new Testcase(new TestcaseIo({ data: test.input }), new TestcaseIo({ data: test.output })),
      );
    });
    return problem;
  }

  private getProbFilePath(srcFile: string): string {
    const dir = this.path.dirname(srcFile);
    const file = this.path.basename(srcFile);
    const hash = this.crypto.md5(srcFile);
    return this.path.resolve(dir, '.cph', `.${file}_${hash}.prob`);
  }
}

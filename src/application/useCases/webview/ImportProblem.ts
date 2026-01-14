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
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import { TOKENS } from '@/composition/tokens';
import type { ImportProblemMsg } from '@/webview/src/msgs';

@injectable()
export class ImportProblem {
  constructor(
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.cphMigrationService) private readonly cphMigration: ICphMigrationService,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
  ) {}

  async exec(msg: ImportProblemMsg): Promise<void> {
    if (!msg.activePath) throw new Error('Active path is required');
    const problem = await this.cphMigration.migrateFromSource(msg.activePath);
    if (!problem) throw new Error('No migratable problem found at the specified path');
    await this.problemService.save(problem);
    await this.repo.get(msg.activePath, true);
    await this.repo.dataRefresh();
  }
}

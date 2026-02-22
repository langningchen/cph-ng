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

import type { CreateProblemMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class CreateProblem {
  public constructor(
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.activePathService) private readonly activePath: IActivePathService,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {}

  public async exec(_msg: CreateProblemMsg): Promise<void> {
    const activePath = this.activePath.getActivePath();
    if (!activePath) throw new Error('Active path is required');
    await this.repo.loadByPath(activePath, true);
    await this.coordinator.onActiveEditorChanged(activePath);
    await this.coordinator.dispatchFullData();
  }
}

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
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { DeleteProblemMsg } from '@/webview/src/msgs';

@injectable()
export class DeleteProblem extends BaseProblemUseCase<DeleteProblemMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.problemService) protected readonly service: IProblemService,
    @inject(TOKENS.activePathService) protected readonly activePath: IActivePathService,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {
    super(repo);
  }

  protected async performAction(
    backgroundProblem: BackgroundProblem,
    _msg: DeleteProblemMsg,
  ): Promise<void> {
    backgroundProblem.abort();
    const { id, problem } = backgroundProblem;
    await this.repo.persist(id);
    await this.service.delete(problem);
    await this.coordinator.onActiveEditorChanged(this.activePath.getActivePath());
    await this.coordinator.dispatchFullData();
  }
}

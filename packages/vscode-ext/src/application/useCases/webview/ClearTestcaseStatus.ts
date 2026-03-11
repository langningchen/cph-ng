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

import type { ITempStorage } from '@v/application/ports/node/ITempStorage';
import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@v/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@v/composition/tokens';
import type { BackgroundProblem } from '@v/domain/entities/backgroundProblem';
import type { ClearTestcaseStatusMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ClearTestcaseStatus extends BaseProblemUseCase<ClearTestcaseStatusMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: ClearTestcaseStatusMsg,
  ): Promise<void> {
    if (msg.testcaseId) this.tmp.dispose(problem.getTestcase(msg.testcaseId).clearResult());
    else this.tmp.dispose(problem.clearResult());
  }
}

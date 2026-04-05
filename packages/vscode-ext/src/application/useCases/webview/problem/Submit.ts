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

import type { SubmitMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ICompanion } from '@/application/ports/services/ICompanion';
import { BaseProblemUseCase } from '@/application/useCases/webview/problem/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';

@injectable()
export class Submit extends BaseProblemUseCase<SubmitMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.companion) protected readonly companion: ICompanion,
  ) {
    super(repo);
  }

  protected async performAction({ problem }: BackgroundProblem, _msg: SubmitMsg): Promise<void> {
    await this.companion.submit(problem);
  }
}

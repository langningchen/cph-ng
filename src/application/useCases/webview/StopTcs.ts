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
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { VerdictName, Verdicts, VerdictType } from '@/domain/entities/verdict';
import type { StopTcsMsg } from '@/webview/src/msgs';

@injectable()
export class StopTcs extends BaseProblemUseCase<StopTcsMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
  ) {
    super(repo);
  }

  protected async performAction(bgProblem: BackgroundProblem, msg: StopTcsMsg): Promise<void> {
    bgProblem.abort(msg.onlyOne ? 'onlyOne' : undefined);
    if (!msg.onlyOne) {
      const tcOrder = bgProblem.problem.getEnabledTcIds();
      for (const tcId of tcOrder) {
        const tc = bgProblem.problem.getTc(tcId);
        if (tc.verdict && Verdicts[tc.verdict].type === VerdictType.running)
          tc.updateResult({ verdict: VerdictName.rejected });
      }
    }
  }
}

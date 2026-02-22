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

import type { StopTestcasesMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { VerdictName, Verdicts, VerdictType } from '@/domain/entities/verdict';

@injectable()
export class StopTestcases extends BaseProblemUseCase<StopTestcasesMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
  ) {
    super(repo);
  }

  protected async performAction(
    bgProblem: BackgroundProblem,
    msg: StopTestcasesMsg,
  ): Promise<void> {
    if (!bgProblem.ac) {
      const testcaseOrder = bgProblem.problem.getEnabledTestcaseIds();
      for (const testcaseId of testcaseOrder) {
        const testcase = bgProblem.problem.getTestcase(testcaseId);
        if (testcase.verdict && Verdicts[testcase.verdict].type === VerdictType.running)
          testcase.updateResult({ verdict: VerdictName.rejected });
      }
    } else bgProblem.abort(msg.testcaseId);
  }
}

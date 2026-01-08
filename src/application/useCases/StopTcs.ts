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
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@/application/useCases/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import { isRunningVerdict, TcVerdicts } from '@/types';
import { waitUntil } from '@/utils/global';
import type { StopTcsMsg } from '@/webview/src/msgs';

@injectable()
export class StopTcs extends BaseProblemUseCase<StopTcsMsg> {
  constructor(@inject(TOKENS.ProblemRepository) protected readonly repo: IProblemRepository) {
    super(repo, true);
  }

  protected async performAction({ problem, ac }: FullProblem, msg: StopTcsMsg): Promise<void> {
    if (ac) {
      ac.abort(msg.onlyOne ? 'onlyOne' : undefined);
      if (msg.onlyOne) return;
      await waitUntil(() => !ac);
    }
    for (const tc of Object.values(problem.tcs))
      if (tc.result && isRunningVerdict(tc.result.verdict)) tc.result.verdict = TcVerdicts.RJ;
  }
}

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
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { ClearTcStatusMsg } from '@/webview/src/msgs';

@injectable()
export class ClearTcStatus extends BaseProblemUseCase<ClearTcStatusMsg> {
  constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.tempStorage) protected readonly tmp: ITempStorage,
  ) {
    super(repo, true);
  }

  protected async performAction({ problem }: FullProblem, msg: ClearTcStatusMsg): Promise<void> {
    if (msg.id) this.tmp.dispose(problem.getTc(msg.id).clearResult());
    else this.tmp.dispose(problem.clearResult());
  }
}

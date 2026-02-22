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

import type { CompareTestcaseMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';

@injectable()
export class CompareTestcase extends BaseProblemUseCase<CompareTestcaseMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: CompareTestcaseMsg,
  ): Promise<void> {
    this.ui.compareFiles(
      this.problemFs.getUri(problem.src.path, `/testcases/${msg.testcaseId}/answer`),
      this.problemFs.getUri(problem.src.path, `/testcases/${msg.testcaseId}/stdout`),
    );
  }
}

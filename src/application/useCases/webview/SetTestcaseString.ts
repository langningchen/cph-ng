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

import type { SetTestcaseStringMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

@injectable()
export class SetTestcaseString extends BaseProblemUseCase<SetTestcaseStringMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: SetTestcaseStringMsg,
  ): Promise<void> {
    const testcase = problem.getTestcase(msg.testcaseId);
    if (msg.label === 'stdin') testcase.stdin = new TestcaseIo({ data: msg.data });
    if (msg.label === 'answer') testcase.answer = new TestcaseIo({ data: msg.data });
  }
}

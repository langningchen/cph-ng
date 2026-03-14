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

import type { TestcaseId } from '@cph-ng/core';
import type { ICrypto } from '@v/application/ports/node/ICrypto';
import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@v/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@v/composition/tokens';
import type { BackgroundProblem } from '@v/domain/entities/backgroundProblem';
import { Testcase } from '@v/domain/entities/testcase';
import { TestcaseIo } from '@v/domain/entities/testcaseIo';
import type { AddTestcaseMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';

@injectable()
export class AddTestcase extends BaseProblemUseCase<AddTestcaseMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    _msg: AddTestcaseMsg,
  ): Promise<void> {
    const testcaseId = this.crypto.randomUUID() as TestcaseId;
    const testcase = new Testcase(new TestcaseIo({ data: '' }), new TestcaseIo({ data: '' }), true);
    problem.addTestcase(testcaseId, testcase);
  }
}

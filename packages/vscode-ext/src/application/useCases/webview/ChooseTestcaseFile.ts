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

import type { ChooseTestcaseFileMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

@injectable()
export class ChooseTestcaseFile extends BaseProblemUseCase<ChooseTestcaseFileMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: ChooseTestcaseFileMsg,
  ): Promise<void> {
    const isInput = msg.label === 'stdin';
    const mainExt = isInput
      ? this.settings.problem.inputFileExtensionList
      : this.settings.problem.outputFileExtensionList;
    const path = await this.ui.openDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: this.translator.t('Choose {type} file', {
        type: isInput ? this.translator.t('stdin') : this.translator.t('answer'),
      }),
      filters: {
        [this.translator.t('Text files')]: mainExt.map((ext) => ext.substring(1)),
        [this.translator.t('All files')]: ['*'],
      },
    });
    if (!path?.length) return;
    const testcase = problem.getTestcase(msg.testcaseId);
    const testcaseIo = new TestcaseIo({ path });
    if (isInput) testcase.stdin = testcaseIo;
    else testcase.answer = testcaseIo;
  }
}

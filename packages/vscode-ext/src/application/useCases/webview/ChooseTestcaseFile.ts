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

import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import type { ISettings } from '@v/application/ports/vscode/ISettings';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi } from '@v/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@v/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@v/composition/tokens';
import type { BackgroundProblem } from '@v/domain/entities/backgroundProblem';
import { TestcaseScanner } from '@v/domain/services/TestcaseScanner';
import type { ChooseTestcaseFileMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ChooseTestcaseFile extends BaseProblemUseCase<ChooseTestcaseFileMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TestcaseScanner) private readonly testcaseScanner: TestcaseScanner,
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
    const fileUri = await this.ui.openDialog({
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
    if (!fileUri?.length) return;
    const testcase = problem.getTestcase(msg.testcaseId);
    const partialTestcase = await this.testcaseScanner.fromFile(fileUri);
    if (isInput) testcase.stdin = partialTestcase.stdin;
    else testcase.answer = partialTestcase.answer;
  }
}

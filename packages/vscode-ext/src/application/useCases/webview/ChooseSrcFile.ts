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
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi } from '@v/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@v/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@v/composition/tokens';
import type { BackgroundProblem } from '@v/domain/entities/backgroundProblem';
import type { ChooseSrcFileMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ChooseSrcFile extends BaseProblemUseCase<ChooseSrcFileMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: ChooseSrcFileMsg,
  ): Promise<void> {
    const path = await this.ui.openDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: this.translator.t('Select {fileType} File', {
        fileType: {
          checker: this.translator.t('Checker'),
          interactor: this.translator.t('Interactor'),
          generator: this.translator.t('Generator'),
          bruteForce: this.translator.t('Brute Force'),
        }[msg.fileType],
      }),
    });
    if (!path) return;
    if (msg.fileType === 'checker') problem.checker = { path, hash: null };
    else if (msg.fileType === 'interactor') problem.interactor = { path, hash: null };
    else if (msg.fileType === 'generator') problem.stressTest.generator = { path, hash: null };
    else problem.stressTest.bruteForce = { path, hash: null };
  }
}

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
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { ChooseSrcFileMsg } from '@/webview/src/msgs';
import type { IUi } from '@/application/ports/vscode/IUi';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';

@injectable()
export class ChooseSrcFile extends BaseProblemUseCase<ChooseSrcFileMsg> {
  constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo, true);
  }

  protected async performAction({ problem }: FullProblem, msg: ChooseSrcFileMsg): Promise<void> {
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
    if (msg.fileType === 'checker') problem.checker = { path };
    else if (msg.fileType === 'interactor') problem.interactor = { path };
    else if (msg.fileType === 'generator') {
      if (!problem.bfCompare) problem.bfCompare = { running: false, msg: '' };
      problem.bfCompare.generator = { path };
    } else {
      if (!problem.bfCompare) problem.bfCompare = { running: false, msg: '' };
      problem.bfCompare.bruteForce = { path };
    }
  }
}

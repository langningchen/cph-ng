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
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import { TcIo } from '@/domain/entities/tcIo';
import type { ToggleTcFileMsg, WebviewTcFileTypes } from '@/webview/src/msgs';

@injectable()
export class ToggleFile extends BaseProblemUseCase<ToggleTcFileMsg> {
  constructor(
    @inject(TOKENS.ProblemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.Settings) protected readonly settings: ISettings,
    @inject(TOKENS.Path) protected readonly path: IPath,
    @inject(TOKENS.FileSystem) protected readonly fs: IFileSystem,
    @inject(TOKENS.Translator) protected readonly translator: ITranslator,
    @inject(TOKENS.Ui) protected readonly ui: IUi,
  ) {
    super(repo, true);
  }

  protected async performAction({ problem }: FullProblem, msg: ToggleTcFileMsg): Promise<void> {
    const tc = problem.getTc(msg.id);
    const fileIo = tc[msg.label];
    if (fileIo.useFile) {
      const data = fileIo.toString();
      if (data.length > this.settings.problem.maxInlineDataLength)
        throw new Error('File too large to inline');
      tc[msg.label] = new TcIo(false, data);
    } else {
      const ext = this.getDefaultExt(msg.label);

      const defaultPath = this.path.join(
        this.path.dirname(problem.src.path),
        `${this.path.basename(problem.src.path, this.path.extname(problem.src.path))}-${msg.id + 1}${ext}`,
      );
      const path = await this.ui.saveDialog({
        defaultPath,
        title: this.translator.t('Select location to save'),
      });
      if (!path) return;
      await this.fs.safeWriteFile(path, fileIo.data);
      tc[msg.label] = new TcIo(true, path);
    }
  }

  private getDefaultExt(label: WebviewTcFileTypes): string {
    const exts =
      label === 'stdin'
        ? this.settings.problem.inputFileExtensionList
        : this.settings.problem.outputFileExtensionList;
    if (exts.length === 0) throw new Error('Extension list is empty');
    return exts[0];
  }
}

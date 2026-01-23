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
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { TestcaseIoService } from '@/infrastructure/problems/testcaseIoService';
import type { ToggleTestcaseFileMsg, WebviewTestcaseFileTypes } from '@/webview/src/msgs';

@injectable()
export class ToggleTestcaseFile extends BaseProblemUseCase<ToggleTestcaseFileMsg> {
  public constructor(
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.testcaseIoService) protected readonly testcaseIoService: TestcaseIoService,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    super(repo);
  }

  protected async performAction(
    { problem }: BackgroundProblem,
    msg: ToggleTestcaseFileMsg,
  ): Promise<void> {
    const testcase = problem.getTestcase(msg.id);
    const fileIo = testcase[msg.label];
    await fileIo.match(
      async (path) => {
        const stat = await this.fs.stat(path);
        if (stat.size > this.settings.problem.maxInlineDataLength)
          throw new Error('File too large to inline');
        const data = await this.fs.readFile(path);
        testcase[msg.label] = new TestcaseIo({ data });
      },
      async (data) => {
        const ext = this.getDefaultExt(msg.label);
        const defaultPath = this.path.resolve(
          this.path.dirname(problem.src.path),
          `${this.path.basename(problem.src.path, this.path.extname(problem.src.path))}-${msg.id + 1}${ext}`,
        );
        const path = await this.ui.saveDialog({
          defaultPath,
          title: this.translator.t('Select location to save'),
        });
        if (!path) return;
        await this.fs.safeWriteFile(path, data);
        testcase[msg.label] = new TestcaseIo({ path });
      },
    );
  }

  private getDefaultExt(label: WebviewTestcaseFileTypes): string {
    const exts =
      label === 'stdin'
        ? this.settings.problem.inputFileExtensionList
        : this.settings.problem.outputFileExtensionList;
    if (exts.length === 0) throw new Error('Extension list is empty');
    return exts[0];
  }
}

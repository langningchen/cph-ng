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

import type { CopyProblemMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import { Uri } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/problem/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';

@injectable()
export class CopyProblem extends BaseProblemUseCase<CopyProblemMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemService) private readonly service: IProblemService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    super(repo);
  }

  protected async performAction(
    backgroundProblem: BackgroundProblem,
    _msg: CopyProblemMsg,
  ): Promise<void> {
    const { problem } = backgroundProblem;
    const srcPath = problem.src.path;
    const ext = this.path.extname(srcPath);
    const defaultName = this.path.basename(srcPath, ext);
    const input = await this.ui.input({
      prompt: this.translator.t('New file name (defaults to current name)'),
      value: defaultName,
    });
    if (input === undefined) return;

    let fileName = input.trim();
    const validationError = this.validateFileName(fileName);
    if (validationError) throw new Error(validationError);

    const inputExt = this.path.extname(fileName);
    if (inputExt) fileName = this.path.basename(fileName, inputExt);
    fileName += ext;
    const destPath = this.path.join(this.path.dirname(srcPath), fileName);
    if (destPath === srcPath)
      throw new Error(this.translator.t('The new file name must be different'));
    if (await this.fs.exists(destPath))
      throw new Error(this.translator.t('File already exists: {fileName}', { fileName }));

    await this.service.copy(problem, destPath);
    this.ui.openFile(Uri.file(destPath));
  }

  private validateFileName(fileName: string): string | null {
    if (!fileName) return this.translator.t('File name must not be empty');
    if (fileName === '.' || fileName === '..')
      return this.translator.t('File name must not be . or ..');
    const hasControlCharacter = [...fileName].some((char) => char.charCodeAt(0) < 32);
    if (/[<>:"/\\|?*]/.test(fileName) || hasControlCharacter)
      return this.translator.t('File name must not contain invalid characters');
    if (/[. ]$/.test(fileName))
      return this.translator.t('File name must not end with a dot or space');

    const baseName = this.path.basename(fileName, this.path.extname(fileName));
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName))
      return this.translator.t('File name is reserved on Windows');
    return null;
  }
}

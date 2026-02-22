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

import type { OpenFileMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import { Uri } from 'vscode';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IUi } from '@/application/ports/vscode/IUi';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class OpenFile implements IMsgHandle<OpenFileMsg> {
  public constructor(
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {}

  public async exec(msg: OpenFileMsg): Promise<void> {
    if (!msg.problemId) {
      this.ui.openFile(Uri.file(msg.path));
      return;
    }
    const backgroundProblem = await this.repo.get(msg.problemId);
    if (!backgroundProblem) throw new Error('Problem not found');
    this.ui.openFile(this.problemFs.getUri(backgroundProblem.problem.src.path, msg.path));
  }
}

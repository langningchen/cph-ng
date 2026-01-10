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
import { Uri } from 'vscode';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import type { OpenFileMsg } from '@/webview/src/msgs';

@injectable()
export class OpenFile {
  constructor(
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {}

  async exec(msg: OpenFileMsg): Promise<void> {
    if (!msg.isVirtual) {
      this.ui.openFile(Uri.file(msg.path));
      return;
    }
    const fullProblem = await this.repo.getFullProblem(msg.activePath);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;
    this.ui.openFile(this.problemFs.getUri(problem, msg.path));
  }
}

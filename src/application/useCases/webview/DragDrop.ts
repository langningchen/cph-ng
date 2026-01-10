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
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import type { TcScanner } from '@/domain/services/TcScanner';
import type { DragDropMsg } from '@/webview/src/msgs';

@injectable()
export class DragDrop {
  constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    private readonly tcScanner: TcScanner,
  ) {}

  async exec(msg: DragDropMsg): Promise<void> {
    const fullProblem = await this.repo.getFullProblem(msg.activePath, true);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    for (const item of msg.items) {
      const isDir = await this.fs
        .stat(item)
        .then((s) => s.isDirectory())
        .catch(() => false);
      if (isDir) {
        this.problemService.applyTcs(problem, await this.tcScanner.fromFolder(item));
        break;
      }
      const ext = this.path.extname(item).toLowerCase();
      if (ext === '.zip') {
        this.problemService.applyTcs(problem, await this.tcScanner.fromZip(problem.src.path, item));
        break;
      }
      const isIoFile =
        this.settings.problem.inputFileExtensionList.includes(ext) ||
        this.settings.problem.outputFileExtensionList.includes(ext);
      if (isIoFile) {
        const tc = await this.tcScanner.fromFile(item);
        problem.addTc(this.crypto.randomUUID(), tc);
      }
    }

    await this.repo.dataRefresh();
  }
}

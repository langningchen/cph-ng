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
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';
import { TestcaseScanner } from '@/domain/services/TestcaseScanner';
import type { DragDropMsg } from '@/webview/src/msgs';

@injectable()
export class DragDrop implements IMsgHandle<DragDropMsg> {
  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.activePathService) private readonly activePath: IActivePathService,
    @inject(TestcaseScanner) private readonly testcaseScanner: TestcaseScanner,
  ) {}

  public async exec(msg: DragDropMsg): Promise<void> {
    const activePath = this.activePath.getActivePath();
    if (!activePath) throw new Error('Active path is required');
    const problemId = await this.repo.loadByPath(activePath, true);
    if (!problemId) throw new Error('Could not load or create problem');
    const fullProblem = await this.repo.get(problemId);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    for (const item of msg.items) {
      const isDir = await this.fs
        .stat(item)
        .then((s) => s.isDirectory())
        .catch(() => false);
      if (isDir) {
        this.problemService.applyTestcases(problem, await this.testcaseScanner.fromFolder(item));
        break;
      }
      const ext = this.path.extname(item).toLowerCase();
      if (ext === '.zip') {
        this.problemService.applyTestcases(
          problem,
          await this.testcaseScanner.fromZip(problem.src.path, item),
        );
        break;
      }
      const isIoFile =
        this.settings.problem.inputFileExtensionList.includes(ext) ||
        this.settings.problem.outputFileExtensionList.includes(ext);
      if (isIoFile) {
        const testcase = await this.testcaseScanner.fromFile(item);
        problem.addTestcase(this.crypto.randomUUID(), testcase);
      }
    }
  }
}

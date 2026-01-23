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
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { ITestcaseService, PathsData } from '@/application/ports/problems/ITestcaseService';
import { TOKENS } from '@/composition/tokens';
import type { Testcase } from '@/domain/entities/testcase';

@injectable()
export class TestcaseService implements ITestcaseService {
  public constructor(
    @inject(TOKENS.testcaseIoService) private testcaseIoService: ITestcaseIoService,
  ) {}

  public async getPaths(io: Testcase): Promise<PathsData> {
    return Promise.all([
      this.testcaseIoService.ensureFilePath(io.stdin),
      this.testcaseIoService.ensureFilePath(io.answer),
    ]).then(([stdinPath, answerPath]) => ({
      stdinPath,
      answerPath,
    }));
  }
}

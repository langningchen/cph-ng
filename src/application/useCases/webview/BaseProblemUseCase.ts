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

import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';

export abstract class BaseProblemUseCase<T extends { activePath: string }> {
  constructor(
    protected readonly repo: IProblemRepository,
    private readonly sendResponse: boolean,
  ) {}

  async exec(msg: T): Promise<void> {
    const fullProblem = await this.repo.getFullProblem(msg.activePath);
    if (!fullProblem) throw new Error('Problem not found');
    await this.performAction(fullProblem, msg);
    await this.repo.dataRefresh(!this.sendResponse);
  }

  protected abstract performAction(fullProblem: FullProblem, msg: T): Promise<void>;
}

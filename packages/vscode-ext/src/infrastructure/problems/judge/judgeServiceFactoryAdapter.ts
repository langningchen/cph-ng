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

import type { IJudgeService } from '@v/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@v/application/ports/problems/judge/IJudgeServiceFactory';
import { InteractiveJudgeService } from '@v/application/useCases/problems/judge/interactiveJudgeService';
import { TraditionalJudgeService } from '@v/application/useCases/problems/judge/traditionalJudgeService';
import type { Problem } from '@v/domain/entities/problem';
import { inject, injectable } from 'tsyringe';

@injectable()
export class JudgeServiceFactory implements IJudgeServiceFactory {
  public constructor(
    @inject(TraditionalJudgeService) private standard: TraditionalJudgeService,
    @inject(InteractiveJudgeService) private interactive: InteractiveJudgeService,
  ) {}

  public create(problem: Problem): IJudgeService {
    if (problem.interactor) return this.interactive;
    return this.standard;
  }
}

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
import type { IJudgeService } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import { InteractiveJudgeService } from '@/application/useCases/problems/judge/interactiveJudgeService';
import { TraditionalJudgeService } from '@/application/useCases/problems/judge/traditionalJudgeService';
import type { IProblem } from '@/types';

@injectable()
export class JudgeServiceFactory implements IJudgeServiceFactory {
  constructor(
    @inject(TraditionalJudgeService) private standard: TraditionalJudgeService,
    @inject(InteractiveJudgeService) private interactive: InteractiveJudgeService,
  ) {}

  create(problem: IProblem): IJudgeService {
    if (problem.interactor) return this.interactive;
    return this.standard;
  }
}

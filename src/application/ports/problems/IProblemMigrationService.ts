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

import type * as History from '@/application/ports/problems/history';
import type { IProblem } from '@/domain/types';

export type OldProblem =
  | History.Problem_0_4_8
  | History.Problem_0_4_3
  | History.Problem_0_3_7
  | History.Problem_0_2_4
  | History.Problem_0_2_3
  | History.Problem_0_2_1
  | History.Problem_0_1_1
  | History.Problem_0_1_0
  | History.Problem_0_0_5
  | History.Problem_0_0_4
  | History.Problem_0_0_3
  | History.Problem_0_0_1;

export interface IProblemMigrationService {
  migrate(rawData: OldProblem): IProblem;
}

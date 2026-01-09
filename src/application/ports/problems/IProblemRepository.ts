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

import type { Problem } from '@/domain/entities/problem';

export interface FullProblem {
  problem: Problem;
  ac: AbortController | null;
  startTime: number;
}

export interface IProblemRepository {
  getDataPath(srcPath: string): string | null;
  listFullProblems(): Promise<FullProblem[]>;
  getFullProblem(path?: string): Promise<FullProblem | null>;
  removeProblem(fullProblem: FullProblem): void;
  dataRefresh(noMsg?: boolean): Promise<void>;
  closeAll(): Promise<void>;
}

// Copyright (C) 2025 Langning Chen
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

import type { CompileData } from '@/core/compiler';
import type { Problem } from '@/types';
import type { KnownResult } from '@/utils/result';

export type CompileSuccess = { ok: true; data: CompileData };
export type CompileKnownFailure = {
  ok: false;
  known: KnownResult<CompileData>;
};
export type CompileException = { ok: false; error: Error };
export type CompileOutcome =
  | CompileSuccess
  | CompileKnownFailure
  | CompileException;

export interface ICompiler {
  compile(
    problem: Problem,
    compileFlag: boolean | null,
    ac: AbortController,
  ): Promise<CompileOutcome>;
}

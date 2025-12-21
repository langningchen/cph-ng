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

import type {
  CompileOutcome,
  ICompiler,
} from '@/application/ports/problems/ICompiler';
import { Compiler } from '@/core/compiler';
import type { Problem } from '@/types';
import { KnownResult } from '@/utils/result';

export class CompilerAdapter implements ICompiler {
  async compile(
    problem: Problem,
    compileFlag: boolean | null,
    ac: AbortController,
  ): Promise<CompileOutcome> {
    try {
      const result = await Compiler.compileAll(problem, compileFlag, ac);
      if (result instanceof KnownResult) {
        return { ok: false, known: result };
      }
      return { ok: true, data: result.data };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}

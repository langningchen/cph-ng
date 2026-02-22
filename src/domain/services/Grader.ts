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

import { injectable } from 'tsyringe';
import { VerdictName } from '@/domain/entities/verdict';

@injectable()
export class Grader {
  public compareStrings(
    actual: string,
    expected: string,
    stderr: string,
    config: { ignoreError: boolean; oleSize?: number; regardPEAsAC: boolean },
  ): VerdictName {
    if (!config.ignoreError && stderr.trim().length > 0) return VerdictName.runtimeError;

    const fix = (s: string) =>
      s
        .trimEnd()
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n');
    const fixedActual = fix(actual);
    const fixedExpected = fix(expected);

    if (config.oleSize && fixedActual.length > fixedExpected.length * config.oleSize)
      return VerdictName.outputLimitExceed;

    const compress = (s: string) => s.replace(/\s/g, '');
    if (compress(actual) !== compress(expected)) return VerdictName.wrongAnswer;

    if (fixedActual !== fixedExpected && !config.regardPEAsAC) return VerdictName.presentationError;

    return VerdictName.accepted;
  }

  public mapTestlibExitCode(code: number): VerdictName {
    const VerdictsMap: Record<number, VerdictName> = {
      0: VerdictName.accepted,
      1: VerdictName.wrongAnswer,
      2: VerdictName.presentationError,
      3: VerdictName.systemError,
      4: VerdictName.wrongAnswer,
      7: VerdictName.partiallyCorrect,
    };
    return VerdictsMap[code] ?? VerdictName.systemError;
  }
}

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
    if (!config.ignoreError && stderr.trim().length > 0) return VerdictName.RE;

    const fix = (s: string) =>
      s
        .trimEnd()
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n');
    const fixedActual = fix(actual);
    const fixedExpected = fix(expected);

    if (config.oleSize && fixedActual.length > fixedExpected.length * config.oleSize)
      return VerdictName.OLE;

    const compress = (s: string) => s.replace(/\s/g, '');
    if (compress(actual) !== compress(expected)) return VerdictName.WA;

    if (fixedActual !== fixedExpected && !config.regardPEAsAC) return VerdictName.PE;

    return VerdictName.AC;
  }

  public mapTestlibExitCode(code: number): VerdictName {
    const VERDICTS_MAP: Record<number, VerdictName> = {
      0: VerdictName.AC,
      1: VerdictName.WA,
      2: VerdictName.PE,
      3: VerdictName.SE,
      4: VerdictName.WA,
      7: VerdictName.PC,
    };
    return VERDICTS_MAP[code] ?? VerdictName.SE;
  }
}

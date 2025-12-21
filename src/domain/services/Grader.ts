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

import { injectable } from 'tsyringe';
import { VerdictName } from '@/domain/verdict';

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

    if (
      config.oleSize &&
      fixedActual.length > fixedExpected.length * config.oleSize
    )
      return VerdictName.OLE;

    const compress = (s: string) => s.replace(/\s/g, '');
    if (compress(actual) !== compress(expected)) return VerdictName.WA;

    if (fixedActual !== fixedExpected && !config.regardPEAsAC)
      return VerdictName.PE;

    return VerdictName.AC;
  }

  public mapTestlibExitCode(code: number): {
    verdict: VerdictName;
    msg?: string;
  } {
    switch (code) {
      case 0:
        return { verdict: VerdictName.AC };
      case 1:
        return { verdict: VerdictName.WA };
      case 2:
        return { verdict: VerdictName.PE };
      case 3:
        return { verdict: VerdictName.SE };
      case 4:
        return { verdict: VerdictName.WA, msg: 'Unexpected EOF' };
      case 7:
        return { verdict: VerdictName.PC };
      default:
        return {
          verdict: VerdictName.SE,
          msg: `Unknown testlib code: ${code}`,
        };
    }
  }
}

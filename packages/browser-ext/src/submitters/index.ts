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

export { BaseSubmitter } from './base';

import { AtCoderSubmitter } from './atcoder';
import type { BaseSubmitter } from './base';
import { CodeforcesSubmitter } from './codeforces';
import { HydroSubmitter } from './hydro';
import { LuoguSubmitter } from './luogu';

export const findSubmitter = ({ hostname }: URL): BaseSubmitter | null => {
  const submitters: readonly BaseSubmitter[] = [
    new CodeforcesSubmitter(),
    new AtCoderSubmitter(),
    new LuoguSubmitter(),
    new HydroSubmitter(),
  ];

  try {
    return submitters.find((s) => s.supportedDomains.includes(hostname)) ?? null;
  } catch {
    return null;
  }
};

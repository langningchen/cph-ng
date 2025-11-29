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

import { TcVerdict, TcVerdicts } from '../types/types.backend';

export class UnknownResult<T> {
  constructor(public data: T) {}
  public flatten() {
    return { verdict: TcVerdicts.UKE.name };
  }
}
export class KnownResult<T = never> {
  constructor(
    public verdict: TcVerdict,
    public msg?: string,
    public data?: T,
  ) {}
  public flatten() {
    return { verdict: this.verdict.name, msg: this.msg };
  }
}
export type Result<T> = UnknownResult<T> | KnownResult<T>;

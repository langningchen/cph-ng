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

import { FileWithHash } from '@/domain/entities/fileWithHash';
import type { IBfCompare } from '@/types';

export class BfCompare {
  constructor(
    public generator?: FileWithHash,
    public bruteForce?: FileWithHash,
    public running: boolean = false,
    public msg: string = '',
  ) {}
  public static fromI(bfCompare: IBfCompare): BfCompare {
    const instance = new BfCompare();
    instance.fromI(bfCompare);
    return instance;
  }
  public fromI(bfCompare: IBfCompare) {
    if (bfCompare.generator) this.generator = FileWithHash.fromI(bfCompare.generator);
    if (bfCompare.bruteForce) this.bruteForce = FileWithHash.fromI(bfCompare.bruteForce);
    this.running = bfCompare.running;
    this.msg = bfCompare.msg;
  }

  public toJSON(): IBfCompare {
    return {
      generator: this.generator ? this.generator.toJSON() : undefined,
      bruteForce: this.bruteForce ? this.bruteForce.toJSON() : undefined,
      running: this.running,
      msg: this.msg,
    };
  }
}

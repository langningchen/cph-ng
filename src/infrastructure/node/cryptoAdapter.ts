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

import { createHash, randomUUID, type UUID } from 'node:crypto';
import { injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';

@injectable()
export class CryptoAdapter implements ICrypto {
  public randomUUID(): UUID {
    return randomUUID();
  }

  public md5(data: string): string {
    return createHash('md5').update(data).digest('hex');
  }
}

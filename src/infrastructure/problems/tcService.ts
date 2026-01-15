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

import { inject, injectable } from 'tsyringe';
import type { ITcIoService } from '@/application/ports/problems/ITcIoService';
import type { ITcService, PathsData } from '@/application/ports/problems/ITcService';
import { TOKENS } from '@/composition/tokens';
import type { Tc } from '@/domain/entities/tc';

@injectable()
export class TcService implements ITcService {
  public constructor(@inject(TOKENS.tcIoService) private tcIoService: ITcIoService) {}

  public async getPaths(io: Tc): Promise<PathsData> {
    return Promise.all([
      this.tcIoService.ensureFilePath(io.stdin),
      this.tcIoService.ensureFilePath(io.answer),
    ]).then(([stdinPath, answerPath]) => ({
      stdinPath,
      answerPath,
    }));
  }
}

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
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ITcIoService } from '@/application/ports/problems/ITcIoService';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { TcIo } from '@/domain/entities/tcIo';

@injectable()
export class TcIoService implements ITcIoService {
  constructor(
    @inject(TOKENS.FileSystem) private fs: IFileSystem,
    @inject(TOKENS.TempStorage) private temp: ITempStorage,
    @inject(TOKENS.Settings) private settings: ISettings,
  ) {}

  public async readContent(tcIo: TcIo): Promise<string> {
    if (!tcIo.useFile) return tcIo.data;
    return await this.fs.readFile(tcIo.data);
  }

  public async ensureFilePath(tcIo: TcIo): Promise<string> {
    if (tcIo.useFile) return tcIo.data;
    const tempPath = this.temp.create('TcIoService');
    await this.fs.safeWriteFile(tempPath, tcIo.data);
    return tempPath;
  }

  public async tryInlining(tcIo: TcIo): Promise<TcIo> {
    if (!tcIo.useFile) return tcIo;

    const stats = await this.fs.stat(tcIo.data);
    if (stats.size <= this.settings.problem.maxInlineDataLength) {
      const content = await this.fs.readFile(tcIo.data);
      return new TcIo(false, content);
    }
    return tcIo;
  }

  public async dispose(tcIo: TcIo): Promise<void> {
    if (tcIo.useFile) this.temp.dispose(tcIo.data);
  }
}

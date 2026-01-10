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
    @inject(TOKENS.fileSystem) private fs: IFileSystem,
    @inject(TOKENS.tempStorage) private temp: ITempStorage,
    @inject(TOKENS.settings) private settings: ISettings,
  ) {}

  public async readContent(io: TcIo): Promise<string> {
    if (!io.useFile) return io.data;
    return await this.fs.readFile(io.data);
  }

  public async writeContent(io: TcIo, content: string): Promise<void> {
    if (!io.useFile) io.data = content;
    else await this.fs.safeWriteFile(io.data, content);
  }

  public async ensureFilePath(io: TcIo): Promise<string> {
    if (io.useFile) return io.data;
    const tempPath = this.temp.create('TcIoService');
    await this.fs.safeWriteFile(tempPath, io.data);
    return tempPath;
  }

  public async tryInlining(io: TcIo): Promise<TcIo> {
    if (!io.useFile) return io;

    const stats = await this.fs.stat(io.data);
    if (stats.size <= this.settings.problem.maxInlineDataLength) {
      const content = await this.fs.readFile(io.data);
      return new TcIo(false, content);
    }
    return io;
  }

  public async dispose(io: TcIo): Promise<void> {
    if (io.useFile) this.temp.dispose(io.data);
  }
}

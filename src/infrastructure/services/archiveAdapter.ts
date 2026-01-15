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

import AdmZip from 'adm-zip';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IArchive } from '@/application/ports/services/IArchive';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class ArchiveAdapter implements IArchive {
  public constructor(@inject(TOKENS.fileSystem) private readonly fs: IFileSystem) {}

  public async unzip(zipPath: string, destPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    await this.fs.mkdir(destPath);
    zip.extractAllTo(destPath, true);
  }
}

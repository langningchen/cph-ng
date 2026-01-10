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
import type { BuildInfoData, IBuildInfo } from '@/application/ports/node/IBuildInfo';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class BuildInfoAdapter implements IBuildInfo {
  private data: BuildInfoData | null = null;

  constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
  ) {}

  async load(): Promise<void> {
    const jsonPath = this.path.resolve(this.extPath, 'dist', 'generated.json');
    const content = await this.fs.readFile(jsonPath);
    this.data = JSON.parse(content);
  }

  get commitHash(): string {
    return this.data?.commitHash || 'unknown';
  }

  get buildTime(): string {
    return this.data?.buildTime || 'unknown';
  }

  get buildBy(): string {
    return this.data?.buildBy || 'unknown';
  }

  get buildType(): string {
    return this.data?.buildType || 'unknown';
  }
}

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

import type { BuildInfoData, IBuildInfo } from '@v/application/ports/node/IBuildInfo';
import type { IFileSystem } from '@v/application/ports/node/IFileSystem';
import type { IPath } from '@v/application/ports/node/IPath';
import { TOKENS } from '@v/composition/tokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class BuildInfoAdapter implements IBuildInfo {
  private data: BuildInfoData | null = null;

  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
  ) {}

  public async load(): Promise<void> {
    const jsonPath = this.path.resolve(this.extPath, 'dist', 'generated.json');
    const content = await this.fs.readFile(jsonPath);
    this.data = JSON.parse(content);
  }

  public get commitHash(): string {
    return this.data?.commitHash || 'unknown';
  }

  public get buildTime(): string {
    return this.data?.buildTime || 'unknown';
  }

  public get buildBy(): string {
    return this.data?.buildBy || 'unknown';
  }

  public get buildType(): string {
    return this.data?.buildType || 'unknown';
  }
}

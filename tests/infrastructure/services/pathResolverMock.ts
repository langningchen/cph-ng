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
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';

@injectable()
export class PathResolverMock implements IPathResolver {
  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.system) private readonly sys: ISystem,
  ) {}

  private renderString(original: string, replacements: [string, string][]): string {
    let result = original;
    for (const [key, value] of replacements) {
      result = result.replaceAll(`\${${key}}`, value);
    }
    return result;
  }

  public async renderTemplate(_problem: Problem): Promise<string> {
    throw new Error('Not implemented');
  }

  public renderPath(original: string): string {
    return this.path.normalize(
      this.renderString(original, [
        ['tmp', this.sys.tmpdir()],
        ['home', this.sys.homedir()],
        ['extensionPath', this.extPath],
      ]),
    );
  }

  public async renderWorkspacePath(_original: string): Promise<string | null> {
    throw new Error('Not implemented');
  }

  public renderPathWithFile(
    _original: string,
    _filePath: string,
    _ignoreError: boolean = false,
  ): string | null {
    throw new Error('Not implemented');
  }

  public renderUnzipFolder(_srcPath: string, _zipPath: string): string | null {
    throw new Error('Not implemented');
  }
}

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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/types';

@injectable()
export class PathRendererMock implements IPathRenderer {
  constructor(
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.ExtensionPath) private readonly path: string,
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
    return this.fs.normalize(
      this.renderString(original, [
        ['tmp', this.fs.tmpdir()],
        ['home', this.fs.homedir()],
        ['extensionPath', this.path],
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

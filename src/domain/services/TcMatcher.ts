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

import { orderBy } from 'natural-orderby';
import { inject, injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';

export interface FilePair {
  input?: string;
  output?: string;
}

@injectable()
export class TcMatcher {
  constructor(
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.path) private readonly path: IPath,
  ) {}

  public matchPairs(filePaths: string[]): FilePair[] {
    const pairs: FilePair[] = [];
    const usedOutputs = new Set<string>();
    const { inputFileExtensionList: inputExts, outputFileExtensionList: outputExts } =
      this.settings.problem;

    const inputFiles = filePaths.filter((p) =>
      inputExts.includes(this.path.extname(p).toLowerCase()),
    );

    for (const input of inputFiles) {
      const dir = this.path.dirname(input);
      const nameWithoutExt = this.path.basename(input, this.path.extname(input));

      let output: string | undefined;
      for (const outExt of outputExts) {
        const potentialOutput = this.path.join(dir, nameWithoutExt + outExt);
        if (filePaths.includes(potentialOutput)) {
          output = potentialOutput;
          usedOutputs.add(potentialOutput);
          break;
        }
      }
      pairs.push({ input, output });
    }

    const orphanedOutputs = filePaths.filter(
      (p) => outputExts.includes(this.path.extname(p).toLowerCase()) && !usedOutputs.has(p),
    );
    for (const output of orphanedOutputs) pairs.push({ output });

    return orderBy(pairs, [
      (p) => (p.input ? 0 : 1),
      (p) => this.path.basename(p.input || p.output || ''),
    ]);
  }
}

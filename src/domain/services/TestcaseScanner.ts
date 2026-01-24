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
import type { IPath } from '@/application/ports/node/IPath';
import type { IArchive } from '@/application/ports/services/IArchive';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { CustomQuickPickItem, IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { type FilePair, TestcaseMatcher } from '@/domain/services/TestcaseMatcher';

@injectable()
export class TestcaseScanner {
  public constructor(
    @inject(TOKENS.archive) private readonly archive: IArchive,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TestcaseMatcher) private readonly matcher: TestcaseMatcher,
  ) {}

  public async fromFile(path: string): Promise<Testcase> {
    const { inputFileExtensionList: inputExts, outputFileExtensionList: outputExts } =
      this.settings.problem;
    const isInput = inputExts.includes(this.path.extname(path).toLowerCase());

    let input = isInput ? path : undefined;
    let output = isInput ? undefined : path;

    const behavior = this.settings.problem.foundMatchTestcaseBehavior;
    if (behavior !== 'never') {
      const pairExts = isInput ? outputExts : inputExts;

      for (const ext of pairExts) {
        const pairPath = path.replace(this.path.extname(path), ext);
        if (await this.fs.exists(pairPath)) {
          const confirmed =
            behavior === 'ask'
              ? await this.ui.confirm(
                  this.translator.t('Found matching {found} file: {file}. Do you want to use it?', {
                    found: isInput ? this.translator.t('answer') : this.translator.t('stdin'),
                    file: this.path.basename(pairPath),
                  }),
                )
              : true;

          if (confirmed) {
            if (isInput) output = pairPath;
            else input = pairPath;
            break;
          }
        }
      }
    }

    return this.toEntity({ input, output });
  }

  public async fromZip(srcPath: string, zipPath: string): Promise<Testcase[]> {
    const folderPath = this.resolver.renderUnzipFolder(srcPath, zipPath);
    if (folderPath === null) return [];
    await this.archive.unzip(zipPath, folderPath);
    if (this.settings.problem.deleteAfterUnzip) await this.fs.rm(zipPath);
    return await this.fromFolder(folderPath);
  }

  public async fromFolder(folderPath: string): Promise<Testcase[]> {
    const allFiles = await this.fs.walk(folderPath);
    const pairs = this.matcher.matchPairs(allFiles);
    if (pairs.length === 0) {
      this.ui.alert('warn', this.translator.t('No test cases found.'));
      return [];
    }

    const items = pairs.map(
      (p, idx) =>
        ({
          label: `${this.path.basename(p.input ? p.input : p.output ? p.output : 'unknown')}`,
          description: this.translator.t('Input {input}, Answer {answer}', {
            input: p.input?.replace(`${folderPath}/`, '') ?? this.translator.t('not found'),
            answer: p.output?.replace(`${folderPath}/`, '') ?? this.translator.t('not found'),
          }),
          value: idx,
          picked: true,
        }) satisfies CustomQuickPickItem<number>,
    );
    const selected = await this.ui.quickPickMany(items, {
      title: this.translator.t('Select test cases to add'),
    });
    return selected.map((p) => this.toEntity(pairs[p]));
  }

  private toEntity(pair: FilePair): Testcase {
    return new Testcase(
      new TestcaseIo(pair.input ? { path: pair.input } : { data: '' }),
      new TestcaseIo(pair.output ? { path: pair.output } : { data: '' }),
    );
  }
}

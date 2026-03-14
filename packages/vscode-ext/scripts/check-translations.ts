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

import { checkTranslations, extractKeys, loadJsonFile } from '@s/check-translations';

const extensionHasError = checkTranslations({
  title: 'Extension Configuration',
  getKeys: () => {
    const keys = new Set<string>();
    const visit = (obj: unknown) => {
      if (typeof obj === 'string' && obj.startsWith('%') && obj.endsWith('%'))
        keys.add(obj.slice(1, -1));
      else if (Array.isArray(obj))
        obj.forEach((item) => {
          visit(item);
        });
      else if (typeof obj === 'object' && obj !== null)
        for (const value of Object.values(obj)) visit(value);
    };
    visit(loadJsonFile('package.json'));
    return keys;
  },
  files: ['package.nls.json', 'package.nls.zh.json'],
});
const runtimeHasError = checkTranslations({
  title: 'Extension Runtime',
  getKeys: () =>
    extractKeys(
      'src',
      ['ts', 'js', 'tsx', 'jsx'],
      ['src/infrastructure/vscode/translatorAdapter.ts'],
    ),
  files: ['l10n/bundle.l10n.zh-cn.json'],
});
process.exit(extensionHasError || runtimeHasError ? 1 : 0);

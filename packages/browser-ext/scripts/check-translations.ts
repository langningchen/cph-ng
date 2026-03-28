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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTranslations, extractKeys } from '@cph-ng/core/check-translations';

process.exit(
  checkTranslations({
    title: 'Browser Extension',
    getKeys: () => {
      const keys = new Set<string>();

      extractKeys('src').forEach((k) => {
        keys.add(k);
      });
      extractKeys('entrypoints').forEach((k) => {
        keys.add(k);
      });

      const configPath = join(process.cwd(), 'wxt.config.ts');
      const configContent = readFileSync(configPath, 'utf-8');
      const msgRegex = /__MSG_([a-zA-Z0-9_]+)__/g;
      while (true) {
        const match = msgRegex.exec(configContent);
        if (match === null) break;
        keys.add(match[1]);
      }

      return keys;
    },
    files: [
      join('public', '_locales', 'en', 'messages.json'),
      join('public', '_locales', 'zh_CN', 'messages.json'),
    ],
  })
    ? 1
    : 0,
);

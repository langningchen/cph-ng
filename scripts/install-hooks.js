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

import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

try {
  if (!existsSync('.git')) {
    throw new Error('No .git directory found');
  }
  const hooksDir = '.git/hooks';
  mkdirSync(hooksDir, { recursive: true });
  for (const type of ['pre-commit', 'commit-msg']) {
    const target = join(hooksDir, type);
    copyFileSync(join('scripts', type), target);
    chmodSync(target, 0o755);
  }
  console.log('Git hooks installed successfully.');
} catch (error) {
  console.error('Failed to install git hooks:', error);
  process.exit(1);
}

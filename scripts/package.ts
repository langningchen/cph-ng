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

import { execSync } from 'node:child_process';
import { cpSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const run = (cmd: string) => {
  execSync(cmd, { stdio: 'inherit' });
};
const copyDirFiles = (src: string, dst: string, ext?: string) => {
  for (const file of readdirSync(src, { withFileTypes: true }))
    if (file.isFile() && (!ext || extname(file.name) === ext))
      cpSync(join(src, file.name), join(dst, file.name));
};

run('pnpm clean');

run('pnpm compile');
copyDirFiles('packages/vscode-webview/dist', 'packages/vscode-ext/dist');
copyDirFiles('packages/vscode-router/dist', 'packages/vscode-ext/dist');

run('pnpm -r --parallel package');
copyDirFiles('packages/vscode-ext', 'dist', '.vsix');
copyDirFiles('packages/browser-ext/dist', 'dist');

console.log('\n=== Build complete ===');
console.log('Output files:');
for (const file of readdirSync('dist')) console.log(`  dist/${file}`);

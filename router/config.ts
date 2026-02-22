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

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Config } from '@r/types';
import { lock } from 'proper-lockfile';
import parser from 'yargs-parser';

const argv = parser(process.argv.slice(2), {
  number: ['port', 'shutdownTimeout'],
  string: ['logFile'],
  alias: { p: 'port', l: 'logFile', s: 'shutdownTimeout' },
});
if (
  !argv.port ||
  argv.port <= 0 ||
  argv.port > 65535 ||
  !argv.logFile ||
  !argv.shutdownTimeout ||
  argv.shutdownTimeout <= 0
) {
  console.error('Invalid arguments');
  process.exit(1);
}

export const config: Config = {
  port: argv.port,
  logFile: resolve(argv.logFile),
  shutdownTimeout: argv.shutdownTimeout,
};

const logFile = config.logFile;
const logDir = dirname(logFile);
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
if (!existsSync(logFile)) writeFileSync(logFile, '');
await lock(logFile);

export const updateConfig = (newConfig: Partial<Config>) => {
  Object.assign(config, newConfig);
};

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
import type { RouterConfig } from '@cph-ng/core';
import { Command } from 'commander';
import { lock } from 'proper-lockfile';

export type LogFileLockRelease = Awaited<ReturnType<typeof lock>>;

export const parseRouterConfig = (argv: string[]): RouterConfig => {
  const program = new Command();
  program
    .requiredOption('-p, --port <number>', 'Port number (1-65535)', (val) => {
      const port = Number.parseInt(val, 10);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('Invalid port');
      return port;
    })
    .requiredOption('-l, --log-file <path>', 'Path to the log file')
    .requiredOption('-s, --shutdown-timeout <number>', 'Shutdown timeout in ms', (val) => {
      const timeout = Number.parseInt(val, 10);
      if (!Number.isInteger(timeout) || timeout <= 0) throw new Error('Invalid timeout');
      return timeout;
    })
    .exitOverride();

  const options = program.parse(argv, { from: 'node' }).opts<{
    port: number;
    logFile: string;
    shutdownTimeout: number;
  }>();

  return {
    port: options.port,
    logFile: resolve(options.logFile),
    shutdownTimeout: options.shutdownTimeout,
  };
};

export const prepareLogFile = async (logFile: string): Promise<LogFileLockRelease> => {
  const logDir = dirname(logFile);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  if (!existsSync(logFile)) writeFileSync(logFile, '');
  return await lock(logFile);
};

export const updateRouterConfig = (config: RouterConfig, newConfig: Partial<RouterConfig>) => {
  Object.assign(config, newConfig);
};

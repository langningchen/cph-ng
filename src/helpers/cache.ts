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

import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirIfNotExists } from '@/utils/process';
import Logger from './logger';
import Settings from './settings';
import { renderPath } from '@/utils/strTemplate';

export default class Cache {
  private static logger: Logger = new Logger('cache');
  private static usedPool: Set<string> = new Set();
  private static freePool: Set<string> = new Set();
  private static monitorInterval?: NodeJS.Timeout;

  public static async ensureDir() {
    return await mkdirIfNotExists(renderPath(Settings.cache.directory));
  }
  public static async startMonitor() {
    if (Cache.monitorInterval) {
      return;
    }
    Cache.monitorInterval = setInterval(() => {
      Cache.logger.debug(
        `Cache Monitor: ${Cache.usedPool.size} used, ${Cache.freePool.size} free.`,
      );
      Cache.logger.trace('Used paths', Array.from(Cache.usedPool));
      Cache.logger.trace('Free paths', Array.from(Cache.freePool));
    }, 10000);
    Cache.logger.info('Cache monitor started');
  }
  public static stopMonitor() {
    if (Cache.monitorInterval) {
      clearInterval(Cache.monitorInterval);
      Cache.monitorInterval = undefined;
      Cache.logger.info('Cache monitor stopped');
    }
  }

  public static createIo(): string {
    let path = Cache.freePool.values().next().value;
    if (path) {
      Cache.freePool.delete(path);
      Cache.logger.trace('Reusing cached path', path);
    } else {
      path = join(renderPath(Settings.cache.directory), randomUUID());
      Cache.logger.trace('Creating new cached path', path);
    }
    Cache.usedPool.add(path);
    // We do not actually create or empty the file here
    // Because the caller may want to write to it later
    return path;
  }
  public static dispose(paths: string | string[]) {
    if (typeof paths === 'string') {
      paths = [paths];
    }
    for (const path of paths) {
      if (Cache.freePool.has(path)) {
        Cache.logger.warn('Duplicate dispose path', path);
      } else if (Cache.usedPool.has(path)) {
        Cache.usedPool.delete(path);
        Cache.freePool.add(path);
        Cache.logger.trace('Disposing cached path', path);
      } else {
        Cache.logger.debug('Path', path, 'is not disposable');
      }
    }
  }
}

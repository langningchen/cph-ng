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
import { mkdir } from 'fs/promises';
import { join } from 'path';
import Logger from './logger';
import Settings from './settings';

export default class Cache {
    private static logger: Logger = new Logger('cache');
    private static usedPool: Set<string> = new Set();
    private static freePool: Set<string> = new Set();
    private static monitorInterval?: NodeJS.Timeout;

    public static async ensureDir() {
        return await mkdir(Settings.cache.directory, {
            recursive: true,
        });
    }
    public static async startMonitor() {
        if (this.monitorInterval) {
            return;
        }
        this.monitorInterval = setInterval(() => {
            this.logger.debug(
                `Cache Monitor: ${this.usedPool.size} used, ${this.freePool.size} free.`,
            );
            this.logger.trace('Used paths', Array.from(this.usedPool));
            this.logger.trace('Free paths', Array.from(this.freePool));
        }, 3000);
        this.logger.info('Cache monitor started');
    }
    public static stopMonitor() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = undefined;
            this.logger.info('Cache monitor stopped');
        }
    }

    public static createIo(): string {
        let path = Cache.freePool.values().next().value;
        if (path) {
            Cache.freePool.delete(path);
            this.logger.trace('Reusing cached path', path);
        } else {
            path = join(Settings.cache.directory, randomUUID());
            this.logger.trace('Creating new cached path', path);
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
                this.logger.warn('Duplicate dispose path', path);
            } else if (Cache.usedPool.has(path)) {
                Cache.usedPool.delete(path);
                Cache.freePool.add(path);
                this.logger.trace('Disposing cached path', path);
            } else {
                this.logger.debug('Path', path, 'is not disposable');
            }
        }
    }
}

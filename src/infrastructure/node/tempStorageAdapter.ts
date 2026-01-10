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
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IPath } from '@/application/ports/node/IPath';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class TempStorageAdapter implements ITempStorage {
  private usedPool: Map<string, string> = new Map();
  private freePool: Set<string> = new Set();
  private monitorInterval: NodeJS.Timeout | undefined;

  constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
  ) {
    this.logger = this.logger.withScope('cache');
  }

  async startMonitor(): Promise<void> {
    if (this.monitorInterval) {
      return;
    }
    this.monitorInterval = setInterval(() => {
      this.logger.debug(`this Monitor: ${this.usedPool.size} used, ${this.freePool.size} free.`);
      this.logger.trace(
        'Used paths',
        Object.entries(this.usedPool).map(([key, value]) => `${key}: ${value}`),
      );
    }, 10000);
    this.logger.info('Cache monitor started');
  }

  create(description: string): string {
    let path = this.freePool.values().next().value;
    if (path) {
      this.freePool.delete(path);
      this.logger.trace('Reusing cached path', path);
    } else {
      path = this.path.resolve(
        this.resolver.renderPath(this.settings.cache.directory),
        this.crypto.randomUUID(),
      );
      this.logger.trace('Creating new cached path', path);
    }
    this.usedPool.set(path, description);
    // We do not actually create or empty the file here
    // Because the caller may want to write to it later
    return path;
  }

  public dispose(paths: string | string[]): void {
    if (typeof paths === 'string') {
      paths = [paths];
    }
    for (const path of paths) {
      if (this.freePool.has(path)) {
        this.logger.warn('Duplicate dispose path', path);
      } else if (this.usedPool.has(path)) {
        this.usedPool.delete(path);
        this.freePool.add(path);
        this.logger.trace('Disposing cached path', path);
      } else {
        this.logger.debug('Path', path, 'is not disposable');
      }
    }
  }
}

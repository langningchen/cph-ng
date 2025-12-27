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

import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { renderPath } from '@/utils/strTemplate';

@injectable()
export class TempStorageAdapter implements ITempStorage {
  private usedPool: Set<string> = new Set();
  private freePool: Set<string> = new Set();
  private monitorInterval: NodeJS.Timeout | undefined;

  constructor(
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
  ) {
    this.logger = this.logger.withScope('cache');
  }

  async startMonitor(): Promise<void> {
    if (this.monitorInterval) {
      return;
    }
    this.monitorInterval = setInterval(() => {
      this.logger.debug(
        `this Monitor: ${this.usedPool.size} used, ${this.freePool.size} free.`,
      );
      this.logger.trace('Used paths', Array.from(this.usedPool));
      this.logger.trace('Free paths', Array.from(this.freePool));
    }, 10000);
    this.logger.info('Cache monitor started');
  }

  create(): string {
    let path = this.freePool.values().next().value;
    if (path) {
      this.freePool.delete(path);
      this.logger.trace('Reusing cached path', path);
    } else {
      path = this.fs.join(
        renderPath(this.settings.cache.directory),
        this.crypto.randomUUID(),
      );
      this.logger.trace('Creating new cached path', path);
    }
    this.usedPool.add(path);
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

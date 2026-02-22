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

import {
  accessSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  type RmOptions,
  writeFileSync,
} from 'node:fs';
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import type { Readable, Writable } from 'node:stream';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class FileSystemAdapter implements IFileSystem {
  public constructor(@inject(TOKENS.path) private readonly path: IPath) {}

  public async readRawFile(path: string): Promise<Buffer<ArrayBuffer>> {
    return readFile(path);
  }

  public async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return readFile(path, { encoding });
  }

  public async safeWriteFile(path: string, data: string | Uint8Array): Promise<void> {
    await mkdir(this.path.dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  public safeCreateFile(path: string): void {
    mkdirSync(this.path.dirname(path), { recursive: true });
    writeFileSync(path, '');
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  public existsSync(path: string): boolean {
    try {
      accessSync(path);
      return true;
    } catch {
      return false;
    }
  }

  public async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  public async readdir(path: string): Promise<string[]> {
    return readdir(path, { encoding: 'utf8' });
  }

  public async stat(
    path: string,
  ): Promise<{ size: number; isFile(): boolean; isDirectory(): boolean }> {
    const stats = await stat(path);
    return {
      size: stats.size,
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
    };
  }

  public async rm(path: string, options?: RmOptions): Promise<void> {
    await rm(path, options);
  }

  public async walk(path: string): Promise<string[]> {
    return await readdir(path, { encoding: 'utf8', recursive: true });
  }

  public createReadStream(path: string): Readable {
    return createReadStream(path);
  }

  public safeCreateWriteStream(path: string): Writable {
    mkdirSync(this.path.dirname(path), { recursive: true });
    return createWriteStream(path);
  }
}

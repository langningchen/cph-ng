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

import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { cwd } from 'node:process';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';

export class FileSystemAdapter implements IFileSystem {
  cwd(): string {
    return cwd();
  }

  tmpdir(): string {
    return tmpdir();
  }

  homedir(): string {
    return homedir();
  }

  normalize(path: string): string {
    return normalize(path);
  }

  join(...paths: string[]): string {
    return join(...paths);
  }

  dirname(path: string): string {
    return dirname(path);
  }

  basename(path: string, suffix?: string): string {
    return basename(path, suffix);
  }

  extname(path: string): string {
    return extname(path);
  }

  async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return readFile(path, { encoding });
  }

  async safeWriteFile(path: string, data: string | Uint8Array): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await rm(path, { recursive: options?.recursive ?? false });
  }
}

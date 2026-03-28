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

import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';

@injectable()
export class PathAdapter implements IPath {
  public normalize(path: string): string {
    return normalize(path);
  }

  public join(...paths: string[]): string {
    return join(...paths);
  }

  public dirname(path: string): string {
    return dirname(path);
  }

  public basename(path: string, suffix?: string): string {
    return basename(path, suffix);
  }

  public extname(path: string): string {
    return extname(path);
  }

  public resolve(...paths: string[]): string {
    return resolve(...paths);
  }

  public relative(from: string, to: string): string {
    return relative(from, to);
  }
}

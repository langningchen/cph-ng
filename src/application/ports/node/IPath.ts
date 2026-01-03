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

/**
 * Interface for path operations.
 * @see {@link https://nodejs.org/api/path.html | Node.js Path API}
 */
export interface IPath {
  /** Normalizes a path, resolving '..' and '.' segments. */
  normalize(path: string): string;

  /** Joins all given path segments together using the platform-specific separator as a delimiter. */
  join(...paths: string[]): string;

  /** Returns the directory name of a path. */
  dirname(path: string): string;

  /**
   * Returns the last portion of a path.
   * @param suffix Suffix to remove from the base name.
   */
  basename(path: string, suffix?: string): string;

  /** Returns the extension name of a path. */
  extname(path: string): string;

  /** Resolves a sequence of paths or path segments into an absolute path. */
  resolve(...paths: string[]): string;
}

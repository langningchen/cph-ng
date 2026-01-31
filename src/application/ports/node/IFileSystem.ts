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

import type { RmOptions } from 'node:fs';
import type { Readable, Writable } from 'node:stream';

/**
 * Interface for file system operations.
 * @see {@link https://nodejs.org/api/fs.html | Node.js File System API}
 */
export interface IFileSystem {
  /**
   * Reads the entire contents of a file as a raw buffer.
   * @throws {@link Error} If the file cannot be read.
   * @returns The file contents as a Buffer.
   */
  readRawFile(path: string): Promise<Buffer<ArrayBuffer>>;

  /**
   * Reads the entire contents of a file.
   * @param encoding The file encoding, default is 'utf-8'.
   * @throws {@link Error} If the file cannot be read.
   * @returns The file contents as a string.
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;

  /**
   * Writes data to a file.
   * @remarks If the directories in the path do not exist, they will be created recursively.
   * @throws {@link Error} If the file cannot be written.
   */
  safeWriteFile(path: string, data: string | Uint8Array): Promise<void>;

  /**
   * Creates an empty file.
   * @remarks If the directories in the path do not exist, they will be created recursively.
   * @throws {@link Error} If the file cannot be created.
   */
  safeCreateFile(path: string): void;

  /** Checks if a file or directory exists. */
  exists(path: string): Promise<boolean>;

  /** Checks if a file or directory exists. */
  existsSync(path: string): boolean;

  /** Recursive creates a directory. */
  mkdir(path: string): Promise<void>;

  /** Reads the contents of a directory. */
  readdir(path: string): Promise<string[]>;

  /** Get the status of a file or directory. */
  stat(path: string): Promise<{ size: number; isFile(): boolean; isDirectory(): boolean }>;

  /** Removes a file. */
  rm(path: string, options?: RmOptions): Promise<void>;

  /** Walks through a directory. */
  walk(path: string): Promise<string[]>;

  /** Create a readable stream of a file. */
  createReadStream(path: string): Readable;

  /** Create a writeable stream of a file. */
  safeCreateWriteStream(path: string): Writable;
}

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
 * Interface for temporary storage management.
 * @remarks This interface provides methods to create and dispose of temporary storage paths.
 * The temporary storage paths are being reused after disposed.
 */
export interface ITempStorage {
  /**
   * Starts the monitor for temporary storage.
   * @remarks This method should be called before using other methods of this interface.
   * It can detect temporary storage leaks and report them to the user.
   */
  startMonitor(): Promise<void>;

  /**
   * Creates a temporary storage path.
   * @param description A description for the temporary storage path,
   * used for monitoring purposes.
   * @returns The path to the created temporary storage.
   */
  create(description: string): string;

  /**
   * Disposes of temporary storage paths.
   * @param paths A path or an array of paths to dispose.
   * @remarks
   * WARNING: Disposed paths are returned to the pool immediately.
   * Any subsequent access to these paths will cause unpredictable behavior
   * or data corruption in concurrent processes.
   */
  dispose(paths: string | string[]): void;
}

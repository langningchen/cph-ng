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

export type SystemPlatform = 'win32' | 'linux' | 'darwin';

/** Interface for system operations. */
export interface ISystem {
  /**
   * Returns the current working directory.
   * @returns The current working directory path.
   */
  cwd(): string;

  /**
   * Returns the operating system's default directory for temporary files.
   * @returns The path to the temporary directory.
   */
  tmpdir(): string;

  /**
   * Returns the home directory of the current user.
   * @returns The path to the home directory.
   */
  homedir(): string;

  /**
   * Returns the operating system platform.
   * @returns The platform identifier.
   */
  platform(): SystemPlatform;
}

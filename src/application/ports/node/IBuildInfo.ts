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

export type BuildInfoData = {
  commitHash: string;
  buildTime: string;
  buildBy: string;
  buildType: string;
};

/**
 * Interface for build information.
 * @see {@link BuildInfoData}
 */
export interface IBuildInfo {
  /**
   * Loads the build information asynchronously.
   * @remarks This method is optional and may not be implemented.
   */
  load?(): Promise<void>;

  /** The commit hash of the build. */
  get commitHash(): string;

  /** The build time as an ISO string. */
  get buildTime(): string;

  /** The user who built the application. */
  get buildBy(): string;

  /** The type of build. */
  get buildType(): string;
}

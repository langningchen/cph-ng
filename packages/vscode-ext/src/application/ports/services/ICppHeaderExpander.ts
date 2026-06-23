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
 * Expands custom (quote-style) `#include "..."` headers inside a C++ source file
 * into the source code itself, so the resulting single-file blob can be submitted
 * to online judges that have no access to the user's local headers.
 *
 * The expansion:
 *   - Recursively inlines each header found via `#include "..."` (angle-bracket
 *     includes are left untouched).
 *   - Wraps each inlined header with `// --- Begin of <name> ---` /
 *     `// --- End of <name> ---` markers.
 *   - Detects cycles / repeated includes and replaces them with a one-line
 *     `// Skipped duplicate of <name>` comment to keep the output compilable.
 *   - Resolves headers against the directory of the file that includes them,
 *     walking upwards if necessary (typical C/C++ search behavior).
 *
 * On success a temporary "project" directory is created under the OS temp
 * directory and the expanded source is mirrored there for inspection /
 * debugging. The expanded source is also returned to the caller so it can be
 * submitted instead of the original code.
 */
export interface ICppHeaderExpander {
  /**
   * Expand custom headers in a C++ source file.
   *
   * @param sourcePath Absolute path to the C++ source file to expand.
   * @returns The expanded source code, or `null` when:
   *   - the file is not detected as C++;
   *   - the file contains no quote-style includes (nothing to expand);
   *   - an unrecoverable error occurs (in which case an alert is shown).
   */
  expand(sourcePath: string): Promise<string | null>;
}

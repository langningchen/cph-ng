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

import { fileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import type { ExecutionContext } from '@/domain/execution';

export const stdinPath = '/tmp/cph-ng/stdin';
export const stdoutPath = '/tmp/cph-ng/stdout';
export const stderrPath = '/tmp/cph-ng/stderr';
export const solutionPath = '/tmp/cph-ng/solution';
export const timeLimitMs = 100;
export const mockCtx: ExecutionContext = {
  cmd: ['echo', 'hello'],
  stdinPath,
  timeLimitMs,
};
export const mockCtxNoArg: ExecutionContext = {
  cmd: [solutionPath],
  stdinPath,
  timeLimitMs,
};
export const invalidJson = `{ invalid json `;
export const createFiles = () => {
  fileSystemMock.safeCreateFile(stdinPath);
  fileSystemMock.safeCreateFile(solutionPath);
};
export const signal = new AbortController().signal;

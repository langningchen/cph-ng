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

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { isWin } from '@t/check';

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
export const signal = new AbortController().signal;
export const createCppExecutable = async (workspace: string, content: string): Promise<string> => {
  const path = join(workspace, 'code.cpp');
  const langs = container.resolve(TOKENS.languageRegistry);
  writeFileSync(path, content);
  const langCpp = langs.getLang(path);
  if (!langCpp) throw new Error('Internal error: can not resolve language for cpp');
  const res = await langCpp.compile({ path }, signal, null, { canUseWrapper: true });
  if (res instanceof Error) throw res;
  return res.path;
};
export const createTestWorkspace = (): string => {
  const testWorkspace = join(tmpdir(), `cph-ng-test-${Date.now()}`);
  mkdirSync(testWorkspace, { recursive: true });
  return testWorkspace;
};
export const cleanupTestWorkspace = (workspace: string): void => {
  rmSync(workspace, { recursive: true, force: true });
};
export const killed = isWin ? 1 : 'SIGTERM';
export const stackOverflow = isWin ? 0xc00000fd : 'SIGSEGV';

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

import { executorMock } from '@t/infrastructure/node/processExecutorMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { anyNumber } from 'vitest-mock-extended';
import { AbortReason } from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { NormalStrategy } from '@/infrastructure/problems/judge/runner/strategies/normalStrategy';

describe('NormalStrategy', () => {
  let strategy: NormalStrategy;

  beforeEach(() => {
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    strategy = container.resolve(NormalStrategy);
  });

  afterEach(() => {
    container.clearInstances();
  });

  const mockCtx: ExecutionContext = {
    cmd: ['echo', 'hello'],
    stdinPath: '/tmp/input',
    timeLimitMs: 1000,
  };

  it('should call executor with correct command and include time addition in timeout', async () => {
    const processOutput = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/stdout.txt',
      stderrPath: '/tmp/stderr.txt',
      timeMs: 450,
      abortReason: undefined,
    };
    executorMock.execute.mockResolvedValue(processOutput);

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(executorMock.execute).toHaveBeenCalledWith({
      cmd: mockCtx.cmd,
      timeoutMs: anyNumber(),
      stdinPath: mockCtx.stdinPath,
      ac,
    });

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(result.isUserAborted).toBe(false);
      expect(result.stdoutPath).toBe(processOutput.stdoutPath);
    }
  });

  it('should map isAborted to true when the process is aborted by user', async () => {
    executorMock.execute.mockResolvedValue({
      codeOrSignal: -1,
      stdoutPath: '',
      stderrPath: '',
      timeMs: 100,
      abortReason: AbortReason.UserAbort,
    });

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(true);
    }
  });

  it('should map isAborted to false when the process times out', async () => {
    executorMock.execute.mockResolvedValue({
      codeOrSignal: -1,
      stdoutPath: '',
      stderrPath: '',
      timeMs: 1200,
      abortReason: AbortReason.Timeout,
    });

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(false);
    }
  });

  it('should passthrough the error if the executor returns an Error object', async () => {
    const executionError = new Error('Executable not found');
    executorMock.execute.mockResolvedValue(executionError);

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(result).toBeInstanceOf(Error);
    expect(result).toBe(executionError);
  });
});

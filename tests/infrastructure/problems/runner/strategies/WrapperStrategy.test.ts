// Copyright (C) 2025 Langning Chen
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

import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { telemetryMock } from '@t/infrastructure/vscode/telemetryMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessExecuteResult,
} from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { WrapperStrategy } from '@/infrastructure/problems/runner/execution/strategies/wrapperStrategy';

describe('WrapperStrategy', () => {
  let strategy: WrapperStrategy;
  let fsMock: MockProxy<IFileSystem>;
  let executorMock: MockProxy<IProcessExecutor>;

  beforeEach(() => {
    fsMock = mock<IFileSystem>();
    executorMock = mock<IProcessExecutor>();

    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerInstance(TOKENS.Settings, settingsMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.ProcessExecutor, executorMock);

    strategy = container.resolve(WrapperStrategy);
  });

  afterEach(() => {
    container.clearInstances();
    vi.restoreAllMocks();
  });

  const mockCtx: ExecutionContext = {
    cmd: ['/tmp/solution'],
    stdin: { useFile: false, data: 'input' },
    timeLimitMs: 1000,
  };

  it('should successfully extract time from stderr and clean up stderr file', async () => {
    const rawStderr =
      'Some error logs...\n-----CPH DATA STARTS-----{"time": 150000}-----\nMore logs...';
    const expectedCleanStderr = 'Some error logs...\n\nMore logs...';

    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/stdout',
      stderrPath: '/tmp/stderr',
      timeMs: 200,
    };

    executorMock.execute.mockResolvedValue(mockProcessResult);
    fsMock.readFile.mockResolvedValue(rawStderr);

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.timeMs).toBe(150);
      expect(result.codeOrSignal).toBe(0);
    }

    expect(fsMock.safeWriteFile).toHaveBeenCalledWith(
      '/tmp/stderr',
      expectedCleanStderr,
    );
  });

  it('should fallback to executor time if CPH data is missing', async () => {
    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/stdout',
      stderrPath: '/tmp/stderr',
      timeMs: 200,
    };

    executorMock.execute.mockResolvedValue(mockProcessResult);
    fsMock.readFile.mockResolvedValue('just regular stderr output');

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.timeMs).toBe(200);
    }
    expect(fsMock.safeWriteFile).not.toHaveBeenCalled();
  });

  it('should handle UserAbort correctly', async () => {
    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/stdout',
      stderrPath: '/tmp/stderr',
      timeMs: 100,
      abortReason: AbortReason.UserAbort,
    };

    executorMock.execute.mockResolvedValue(mockProcessResult);
    fsMock.readFile.mockResolvedValue('');

    const result = await strategy.execute(mockCtx, new AbortController());

    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(true);
    }
  });

  it('should return error if executor fails', async () => {
    const execError = new Error('Execution failed');
    executorMock.execute.mockResolvedValue(execError);

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).toBe(execError);
  });

  it('should handle malformed JSON in wrapper data gracefully', async () => {
    const malformedStderr = '-----CPH DATA STARTS-----{invalid-json}-----';
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 300,
    });
    fsMock.readFile.mockResolvedValue(malformedStderr);

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.timeMs).toBe(300);
    }
    expect(loggerMock.error).toHaveBeenCalled();
    expect(telemetryMock.error).toHaveBeenCalledWith(
      'wrapperError',
      expect.any(Error),
      expect.objectContaining({ output: '{invalid-json}' }),
    );
  });

  it('should call executor with correct timeout addition', async () => {
    settingsMock.runner.timeAddition = 500;
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 100,
    });
    fsMock.readFile.mockResolvedValue('');

    await strategy.execute(mockCtx, new AbortController());

    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: mockCtx.timeLimitMs + 500,
      }),
    );
  });
});

// TO-DO: Real integration test

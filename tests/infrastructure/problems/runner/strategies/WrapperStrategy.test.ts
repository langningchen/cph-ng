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
import { getTmpStoragePath, tempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import {
  createFiles,
  invalidJson,
  mockCtx,
  signal,
  stderrPath,
  stdoutPath,
} from '@t/infrastructure/problems/runner/strategies/constants';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { telemetryMock } from '@t/infrastructure/vscode/telemetryMock';
import { mock } from '@t/mock';
import { vol } from 'memfs';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessExecuteResult,
} from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionData } from '@/domain/execution';
import {
  type WrapperData,
  WrapperStrategy,
} from '@/infrastructure/problems/judge/runner/strategies/wrapperStrategy';

describe('WrapperStrategy', () => {
  let strategy: WrapperStrategy;
  let executorMock: MockProxy<IProcessExecutor>;

  beforeEach(() => {
    executorMock = mock<IProcessExecutor>();

    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerInstance(TOKENS.tempStorage, tempStorageMock);

    strategy = container.resolve(WrapperStrategy);
    createFiles();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully extract time from stderr and clean up stderr file', async () => {
    await vol.promises.writeFile(
      getTmpStoragePath(0),
      JSON.stringify({ time: 150000 } as WrapperData),
    );
    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 200,
    };
    executorMock.execute.mockResolvedValue(mockProcessResult);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 150,
      isUserAborted: false,
    } satisfies ExecutionData);
  });

  it('should fallback to executor time if CPH data is missing', async () => {
    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 200,
    };
    executorMock.execute.mockResolvedValue(mockProcessResult);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 200,
      isUserAborted: false,
    } satisfies ExecutionData);
  });

  it('should handle UserAbort correctly', async () => {
    await vol.promises.writeFile(
      getTmpStoragePath(0),
      JSON.stringify({ time: 90000 } as WrapperData),
    );
    const mockProcessResult: ProcessExecuteResult = {
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 100,
      abortReason: AbortReason.UserAbort,
    };
    executorMock.execute.mockResolvedValue(mockProcessResult);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 90,
      isUserAborted: true,
    } satisfies ExecutionData);
  });

  it('should return error if executor fails', async () => {
    const execError = new Error('Execution failed');
    executorMock.execute.mockResolvedValue(execError);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).toBe(execError);
  });

  it('should handle malformed JSON in wrapper data gracefully', async () => {
    await vol.promises.writeFile(getTmpStoragePath(0), invalidJson);
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 300,
    });

    const result = await strategy.execute(mockCtx, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 300,
      isUserAborted: false,
    } satisfies ExecutionData);
    expect(loggerMock.error).toHaveBeenCalled();
    expect(telemetryMock.error).toHaveBeenCalledWith('wrapperError', expect.any(SyntaxError), {
      content: invalidJson,
    });
  });

  it('should call executor with correct timeout addition', async () => {
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 100,
    });

    await strategy.execute(mockCtx, signal);

    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: mockCtx.timeLimitMs + settingsMock.runner.timeAddition,
      }),
    );
  });
});

// TO-DO: Real integration test

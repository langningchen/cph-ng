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

import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { systemMock } from '@t/infrastructure/node/systemMock';
import {
  signal,
  stderrPath,
  stdoutPath,
} from '@t/infrastructure/problems/runner/strategies/constants';
import { PathResolverMock } from '@t/infrastructure/services/pathResolverMock';
import { extensionPathMock } from '@t/infrastructure/vscode/extensionPathMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { mock } from '@t/mock';
import type { Volume } from 'memfs';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type {
  IProcessExecutor,
  ProcessExecuteResult,
} from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import { RunnerProviderAdapter } from '@/infrastructure/problems/judge/runner/strategies/runnerProviderAdapter';

describe('RunnerProviderAdapter', () => {
  let adapter: RunnerProviderAdapter;
  let executorMock: MockProxy<IProcessExecutor>;
  let fileSystemMock: MockProxy<IFileSystem>;
  let _vol: Volume;

  const mockProcessResult: ProcessExecuteResult = {
    codeOrSignal: 0,
    stdoutPath,
    stderrPath,
    timeMs: 200,
  };

  beforeEach(() => {
    ({ fileSystemMock, vol: _vol } = createFileSystemMock());
    fileSystemMock.safeCreateFile(stdoutPath);
    fileSystemMock.safeCreateFile(stderrPath);
    executorMock = mock<IProcessExecutor>();

    container.registerInstance(TOKENS.extensionPath, extensionPathMock);
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.path, pathMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.system, systemMock);
    container.registerSingleton(TOKENS.pathResolver, PathResolverMock);

    adapter = container.resolve(RunnerProviderAdapter);
  });

  it('should return cached path immediately if already resolved', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockImplementation(async (_options) => {
      fileSystemMock.safeCreateFile('/tmp/cph-ng/runner');
      return mockProcessResult;
    });

    const firstPath = await adapter.getRunnerPath(signal);
    const secondPath = await adapter.getRunnerPath(signal);

    expect(firstPath).toBe(secondPath);
    expect(executorMock.execute).toHaveBeenCalledTimes(1);
  });

  it('should only trigger one compilation if multiple calls are made simultaneously', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockImplementation(async (_options) => {
      await new Promise<void>((resolve, _reject) => setImmediate(resolve));
      fileSystemMock.safeCreateFile('/tmp/cph-ng/runner');
      return mockProcessResult;
    });

    const [path1, path2] = await Promise.all([
      adapter.getRunnerPath(signal),
      adapter.getRunnerPath(signal),
    ]);

    expect(path1).toBe(path2);
    expect(executorMock.execute).toHaveBeenCalledTimes(1);
  });

  it('should use correct compiler flags and names for Windows', async () => {
    systemMock.platform.mockReturnValue('win32');
    executorMock.execute.mockImplementation(async (_options) => {
      fileSystemMock.safeCreateFile('/tmp/cph-ng/runner.exe');
      return mockProcessResult;
    });

    const path = await adapter.getRunnerPath(signal);

    expect(path).toContain('runner.exe');
    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: expect.arrayContaining(['-lpsapi', '-ladvapi32', '-static']),
      }),
    );
  });

  it('should use correct compiler flags and names for Linux', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockImplementation(async (_options) => {
      fileSystemMock.safeCreateFile('/tmp/cph-ng/runner');
      return mockProcessResult;
    });

    const path = await adapter.getRunnerPath(signal);

    expect(path).toContain('runner');
    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: expect.arrayContaining(['-pthread']),
      }),
    );
  });

  it('should throw error if compilation returns non-zero exit code', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockImplementation(async (_options) => {
      fileSystemMock.safeCreateFile('/tmp/cph-ng/runner');
      return { ...mockProcessResult, codeOrSignal: 1 };
    });

    await expect(adapter.getRunnerPath(signal)).rejects.toThrow(
      'Runner compilation failed with code 1',
    );
  });

  it('should throw error if compilation returns an Error object', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockResolvedValue(new Error('Compiler not found'));

    await expect(adapter.getRunnerPath(signal)).rejects.toThrow(
      'Failed to compile runner utility: Compiler not found',
    );
  });

  it('should throw error if output file is missing after successful compilation', async () => {
    systemMock.platform.mockReturnValue('linux');
    executorMock.execute.mockResolvedValue(mockProcessResult);

    await expect(adapter.getRunnerPath(signal)).rejects.toThrow(
      'Compiler exited successfully but output file is missing',
    );
  });
});

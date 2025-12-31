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

import { join, normalize } from 'node:path';
import { PathRendererMock } from '@t/infrastructure/services/pathRendererMock';
import { extensionPathMock } from '@t/infrastructure/vscode/extensionPathMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ISystem } from '@/application/ports/node/ISystem';
import { TOKENS } from '@/composition/tokens';
import { RunnerProviderAdapter } from '@/infrastructure/problems/runner/execution/strategies/runnerProviderAdapter';

describe('RunnerProviderAdapter', () => {
  let adapter: RunnerProviderAdapter;
  let fsMock: MockProxy<IFileSystem>;
  let systemMock: MockProxy<ISystem>;
  let executorMock: MockProxy<IProcessExecutor>;

  beforeEach(() => {
    fsMock = mock<IFileSystem>();
    systemMock = mock<ISystem>();
    executorMock = mock<IProcessExecutor>();

    fsMock.join.mockImplementation(join);
    fsMock.normalize.mockImplementation(normalize);

    container.registerInstance(TOKENS.ExtensionPath, extensionPathMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.System, systemMock);
    container.registerInstance(TOKENS.ProcessExecutor, executorMock);
    container.registerInstance(TOKENS.Settings, settingsMock);
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerSingleton(TOKENS.PathRenderer, PathRendererMock);

    adapter = container.resolve(RunnerProviderAdapter);
  });

  it('should return cached path immediately if already resolved', async () => {
    const abortController = new AbortController();

    systemMock.type.mockReturnValue('Linux');
    fsMock.exists.mockResolvedValue(true);

    const firstPath = await adapter.getRunnerPath(abortController);
    const secondPath = await adapter.getRunnerPath(abortController);

    expect(firstPath).toBe(secondPath);
    expect(fsMock.exists).toHaveBeenCalledTimes(1);
  });

  it('should only trigger one compilation if multiple calls are made simultaneously', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Linux');

    fsMock.exists.mockResolvedValueOnce(false).mockResolvedValue(true);

    executorMock.execute.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { codeOrSignal: 0, stdoutPath: '', stderrPath: '', timeMs: 0 };
    });

    const [path1, path2] = await Promise.all([
      adapter.getRunnerPath(abortController),
      adapter.getRunnerPath(abortController),
    ]);

    expect(path1).toBe(path2);
    expect(executorMock.execute).toHaveBeenCalledTimes(1);
  });

  it('should use correct compiler flags and names for Windows', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Windows_NT');
    fsMock.exists.mockResolvedValue(false); // Does not exist

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '',
      stderrPath: '',
      timeMs: 0,
    });

    fsMock.exists.mockResolvedValueOnce(false).mockResolvedValue(true);

    const path = await adapter.getRunnerPath(abortController);

    expect(path).toContain('runner-windows.exe');
    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: expect.arrayContaining(['-lpsapi', '-ladvapi32', '-static']),
      }),
    );
  });

  it('should use correct compiler flags and names for Linux', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Linux');
    fsMock.exists.mockResolvedValueOnce(false).mockResolvedValue(true);

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '',
      stderrPath: '',
      timeMs: 0,
    });

    const path = await adapter.getRunnerPath(abortController);

    expect(path).toContain('runner-linux');
    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: expect.arrayContaining(['-pthread']),
      }),
    );
  });

  it('should throw error if compilation returns non-zero exit code', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Linux');
    fsMock.exists.mockResolvedValue(false);

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 1,
      stdoutPath: '',
      stderrPath: '/tmp/stderr',
      timeMs: 0,
    });
    fsMock.readFile.mockResolvedValue('Syntax Error at line 1');

    await expect(adapter.getRunnerPath(abortController)).rejects.toThrow(
      'Runner compilation failed with code 1',
    );
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('should throw error if compilation returns an Error object', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Linux');
    fsMock.exists.mockResolvedValue(false);

    executorMock.execute.mockResolvedValue(new Error('Compiler not found'));

    await expect(adapter.getRunnerPath(abortController)).rejects.toThrow(
      'Failed to compile runner utility: Compiler not found',
    );
  });

  it('should throw error if output file is missing after successful compilation', async () => {
    const abortController = new AbortController();
    systemMock.type.mockReturnValue('Linux');

    fsMock.exists.mockResolvedValue(false);
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '',
      stderrPath: '',
      timeMs: 0,
    });

    await expect(adapter.getRunnerPath(abortController)).rejects.toThrow(
      'Compiler exited successfully but output file is missing',
    );
  });
});

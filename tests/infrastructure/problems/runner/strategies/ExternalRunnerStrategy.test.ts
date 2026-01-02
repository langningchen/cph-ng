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

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasCppCompiler } from '@t/check';
import { tempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import { PathRendererMock } from '@t/infrastructure/services/pathRendererMock';
import { extensionPathMock } from '@t/infrastructure/vscode/extensionPathMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { telemetryMock } from '@t/infrastructure/vscode/telemetryMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type {
  IProcessExecutor,
  ProcessExecuteResult,
  ProcessHandle,
  ProcessOutput,
} from '@/application/ports/node/IProcessExecutor';
import type { IRunnerProvider } from '@/application/ports/problems/judge/runner/execution/strategies/IRunnerProvider';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { ExternalRunnerStrategy } from '@/infrastructure/problems/judge/runner/strategies/externalRunnerStrategy';
import { RunnerProviderAdapter } from '@/infrastructure/problems/judge/runner/strategies/runnerProviderAdapter';

describe('ExternalRunnerStrategy', () => {
  let strategy: ExternalRunnerStrategy;
  let fsMock: MockProxy<IFileSystem>;
  let executorMock: MockProxy<IProcessExecutor>;
  let runnerProviderMock: MockProxy<IRunnerProvider>;
  let processHandleMock: MockProxy<ProcessHandle>;

  const MOCK_RUNNER_PATH = '/path/to/runner';

  beforeEach(() => {
    vi.useFakeTimers();

    fsMock = mock<IFileSystem>();
    executorMock = mock<IProcessExecutor>();
    runnerProviderMock = mock<IRunnerProvider>();
    processHandleMock = mock<ProcessHandle>();

    runnerProviderMock.getRunnerPath.mockResolvedValue(MOCK_RUNNER_PATH);

    container.registerInstance(TOKENS.ExtensionPath, extensionPathMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.ProcessExecutor, executorMock);
    container.registerInstance(TOKENS.RunnerProvider, runnerProviderMock);
    container.registerInstance(TOKENS.Settings, settingsMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerInstance(TOKENS.TempStorage, tempStorageMock);
    container.registerInstance(TOKENS.Translator, translatorMock);
    container.registerSingleton(TOKENS.PathRenderer, PathRendererMock);

    strategy = container.resolve(ExternalRunnerStrategy);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.clearInstances();
  });

  const mockCtx: ExecutionContext = {
    cmd: ['/tmp/solution'],
    stdinPath: '/tmp/input',
    timeLimitMs: 1000,
  };

  it('should successfully run through external runner and parse JSON output', async () => {
    const mockRunnerOutput = {
      error: false,
      killed: false,
      time: 150,
      memory: 10,
      exitCode: 0,
      signal: 0,
    };

    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/runner_stdout',
      stderrPath: '/tmp/runner_stderr',
    } as ProcessOutput);

    fsMock.readFile.mockResolvedValue(JSON.stringify(mockRunnerOutput));

    const ac = new AbortController();
    const resultPromise = strategy.execute(mockCtx, ac.signal);
    const result = await resultPromise;

    expect(result).not.toBeInstanceOf(Error);
    expect(executorMock.spawn).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.timeMs).toBe(150);
      expect(result.memoryMb).toBe(10);
      expect(result.codeOrSignal).toBe(0);
    }
  });

  it('should perform soft kill when time limit is exceeded', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);

    let resolveWait: (value: ProcessExecuteResult) => void;
    const waitPromise = new Promise<ProcessExecuteResult>((resolve) => {
      resolveWait = resolve;
    });
    processHandleMock.wait.mockReturnValue(waitPromise);
    processHandleMock.writeStdin.mockImplementation((data) => {
      if (data === 'k') {
        resolveWait({
          codeOrSignal: 0,
          stdoutPath: '/tmp/runner_stdout',
          stderrPath: '/tmp/runner_stderr',
          timeMs: 1000,
        });
      }
    });

    fsMock.readFile.mockResolvedValue(
      JSON.stringify({
        error: false,
        killed: true,
        time: 1200,
        memory: 5,
        exitCode: 0,
        signal: 0,
      }),
    );

    const ac = new AbortController();
    const resultPromise = strategy.execute(mockCtx, ac.signal);
    await vi.advanceTimersByTimeAsync(mockCtx.timeLimitMs + settingsMock.runner.timeAddition + 100);
    const result = await resultPromise;

    expect(result).not.toBeInstanceOf(Error);
    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(false);
      expect(result.timeMs).toBe(1200);
    }
  });

  it('should return error if runner provider fails', async () => {
    runnerProviderMock.getRunnerPath.mockRejectedValue(new Error('No runner binary'));

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals(
      'Failed to prepare runner utility: {codeOrSignal},No runner binary',
    );
  });

  it('should return error if runner returns non-zero exit code', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 1,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 1000,
    });

    const ac = new AbortController();
    const result = await strategy.execute(mockCtx, ac.signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner exited with code {codeOrSignal},1');
  });

  it('should throw error if runner output is malformed JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation((..._args) => {});

    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 1000,
    });
    fsMock.readFile.mockResolvedValue('invalid-json');

    const ac = new AbortController();
    await expect(strategy.execute(mockCtx, ac.signal)).rejects.toThrow(
      'Runner output is invalid JSON',
    );

    expect(console.error).toHaveBeenCalledWith(
      '[Telemetry Error] parseRunnerError',
      expect.any(Object),
    );
  });

  it('should throw error if runner reports an internal error', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 1000,
    });
    fsMock.readFile.mockResolvedValue(
      JSON.stringify({
        error: true,
        error_type: 1,
        error_code: 101,
      }),
    );

    const ac = new AbortController();
    await expect(strategy.execute(mockCtx, ac.signal)).rejects.toThrow(
      'Runner reported error: {type} (Code: {code}),1,101',
    );
  });

  it('should handle User Abort correctly', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);

    let resolveWait: (value: ProcessExecuteResult) => void;
    const waitPromise = new Promise<ProcessExecuteResult>((resolve) => {
      resolveWait = resolve;
    });
    processHandleMock.wait.mockReturnValue(waitPromise);
    processHandleMock.writeStdin.mockImplementation((data) => {
      if (data === 'k') {
        resolveWait({
          codeOrSignal: 0,
          stdoutPath: '/tmp/runner_stdout',
          stderrPath: '/tmp/runner_stderr',
          timeMs: 1000,
        });
      }
    });

    fsMock.readFile.mockResolvedValue(
      JSON.stringify({
        error: false,
        killed: true,
        time: 50,
        memory: 1,
        exitCode: 0,
        signal: 9,
      }),
    );

    const ac = new AbortController();
    const resultPromise = strategy.execute(mockCtx, ac.signal);
    setTimeout(() => ac.abort(), 200);
    await vi.advanceTimersToNextTimerAsync();
    const result = await resultPromise;

    expect(result).not.toBeInstanceOf(Error);
    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(true);
      expect(result.timeMs).toBe(50);
    }
  });
});

describe.runIf(hasCppCompiler)('ExternalRunnerStrategy Real Integration', () => {
  const inputFile = 'input.in';
  let strategy: ExternalRunnerStrategy;
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = join(tmpdir(), `cph-ng-test-${Date.now()}`);
    mkdirSync(testWorkspace, { recursive: true });
    writeFileSync(join(testWorkspace, inputFile), '');
    settingsMock.cache.directory = testWorkspace;

    container.registerInstance(TOKENS.ExtensionPath, extensionPathMock);
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.Settings, settingsMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerInstance(TOKENS.Translator, translatorMock);

    container.registerSingleton(TOKENS.Clock, ClockAdapter);
    container.registerSingleton(TOKENS.Crypto, CryptoAdapter);
    container.registerSingleton(TOKENS.FileSystem, FileSystemAdapter);
    container.registerSingleton(TOKENS.PathRenderer, PathRendererMock);
    container.registerSingleton(TOKENS.ProcessExecutor, ProcessExecutorAdapter);
    container.registerSingleton(TOKENS.RunnerProvider, RunnerProviderAdapter);
    container.registerSingleton(TOKENS.System, SystemAdapter);
    container.registerSingleton(TOKENS.TempStorage, TempStorageAdapter);

    strategy = container.resolve(ExternalRunnerStrategy);
  });

  afterEach(() => {
    container.clearInstances();
    testWorkspace && rmSync(testWorkspace, { recursive: true, force: true });
  });

  const createExecutableScript = (content: string): string => {
    const scriptPath = join(testWorkspace, 'script.js');
    writeFileSync(scriptPath, `#!/usr/bin/env node\n${content}`);
    chmodSync(scriptPath, 0o755);
    return scriptPath;
  };

  it('should execute a real program through the real runner binary', async () => {
    const scriptPath = createExecutableScript('console.log("hello_from_node")');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs: 2000,
    };
    const ac = new AbortController();
    const result = await strategy.execute(ctx, ac.signal);

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(result.timeMs).toBeGreaterThan(0);

      const output = readFileSync(result.stdoutPath, 'utf-8');
      expect(output.trim()).toBe('hello_from_node');
    }
  });

  it('should successfully perform a "Soft Kill" on the real runner binary', async () => {
    const scriptPath = createExecutableScript('while (true) {}');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs: 500,
    };

    const ac = new AbortController();
    const result = await strategy.execute(ctx, ac.signal);

    console.log(result);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(false);
      expect(result.timeMs).toBeGreaterThanOrEqual(
        ctx.timeLimitMs + settingsMock.runner.timeAddition,
      );
    }
  });

  it('should handle User Abort by sending "k" to the real runner', async () => {
    const scriptPath = createExecutableScript('while (true) {}');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs: 1000,
    };

    const ac = new AbortController();
    const promise = strategy.execute(ctx, ac.signal);
    setTimeout(() => ac.abort(), 200);

    const result = await promise;

    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(true);
      expect(result.timeMs).toBeLessThan(1000);
    }
  });
});

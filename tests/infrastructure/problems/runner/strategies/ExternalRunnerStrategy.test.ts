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

import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hasCppCompiler } from '@t/check';
import stackCode from '@t/fixtures/stack.cpp?raw';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import {
  cleanupTestWorkspace,
  createCppExecutable,
  createJsExecutable,
  createTestWorkspace,
  invalidJson,
  mockCtxNoArg,
  signal,
  solutionPath,
  stderrPath,
  stdinPath,
  stdoutPath,
  timeLimitMs,
} from '@t/infrastructure/problems/runner/strategies/constants';
import { PathResolverMock } from '@t/infrastructure/services/pathResolverMock';
import { compilationOutputChannelMock } from '@t/infrastructure/vscode/compilationOutputChannelMock';
import { extensionPathMock } from '@t/infrastructure/vscode/extensionPathMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { telemetryMock } from '@t/infrastructure/vscode/telemetryMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import type { Volume } from 'memfs';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type {
  IProcessExecutor,
  ProcessExecuteResult,
  ProcessHandle,
  ProcessOutput,
} from '@/application/ports/node/IProcessExecutor';
import type { IRunnerProvider } from '@/application/ports/problems/judge/runner/execution/strategies/IRunnerProvider';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext, ExecutionData } from '@/domain/execution';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { LangCpp } from '@/infrastructure/problems/judge/langs/cppStrategy';
import { LanguageRegistry } from '@/infrastructure/problems/judge/langs/languageRegistry';
import {
  ExternalRunnerStrategy,
  type RunnerOutput,
} from '@/infrastructure/problems/judge/runner/strategies/externalRunnerStrategy';
import { RunnerProviderAdapter } from '@/infrastructure/problems/judge/runner/strategies/runnerProviderAdapter';

describe('ExternalRunnerStrategy', () => {
  let strategy: ExternalRunnerStrategy;
  let executorMock: MockProxy<IProcessExecutor>;
  let runnerProviderMock: MockProxy<IRunnerProvider>;
  let processHandleMock: MockProxy<ProcessHandle>;
  let fileSystemMock: MockProxy<IFileSystem>;
  let tempStorageMock: TempStorageMock;
  let vol: Volume;

  const mockRunnerPath = '/path/to/runner';
  const runnerOutput = {
    error: false,
    killed: true,
    time: 100,
    memory: 10,
    exitCode: 0,
    signal: 0,
  } satisfies RunnerOutput;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ fileSystemMock, vol } = createFileSystemMock());

    executorMock = mock<IProcessExecutor>();
    runnerProviderMock = mock<IRunnerProvider>();
    processHandleMock = mock<ProcessHandle>();
    processHandleMock.pid = 12345;
    processHandleMock.stdoutPath = stdoutPath;
    processHandleMock.stderrPath = stderrPath;
    processHandleMock.writeStdin.mockImplementation((input) => {
      loggerMock.info(`Mock writeStdin called with: ${input}`);
    });
    processHandleMock.closeStdin.mockImplementation(() => {
      loggerMock.info(`Mock closeStdin called`);
    });
    processHandleMock.kill.mockImplementation((signal?) => {
      loggerMock.info(`Mock kill called with signal: ${signal}`);
    });
    runnerProviderMock.getRunnerPath.mockResolvedValue(mockRunnerPath);
    fileSystemMock.safeCreateFile(solutionPath);
    fileSystemMock.safeCreateFile(stdinPath);
    fileSystemMock.safeCreateFile(stdoutPath);
    fileSystemMock.safeCreateFile(stderrPath);

    container.registerInstance(TOKENS.extensionPath, extensionPathMock);
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.runnerProvider, runnerProviderMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);
    container.registerSingleton(TOKENS.pathResolver, PathResolverMock);

    strategy = container.resolve(ExternalRunnerStrategy);
    tempStorageMock = container.resolve(TOKENS.tempStorage) as TempStorageMock;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should successfully run through external runner and parse JSON output', async () => {
    await vol.promises.writeFile(stdoutPath, JSON.stringify(runnerOutput));

    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 200,
    } satisfies ProcessOutput);

    const resultPromise = strategy.execute(mockCtxNoArg, signal);
    const result = await resultPromise;

    expect(executorMock.spawn).toHaveBeenCalled();
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: TempStorageMock.getPath(0),
      stderrPath: TempStorageMock.getPath(1),
      timeMs: 100,
      memoryMb: 10,
      isUserAborted: false,
    } satisfies ExecutionData);
    if (!(result instanceof Error))
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
  });

  it('should return error when cmd has arguments', async () => {
    const invalidCtx = {
      ...mockCtxNoArg,
      cmd: ['program', 'arg1'],
    };
    const result = await strategy.execute(invalidCtx, signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals(
      'External runner only supports single program without arguments',
    );
    if (!(result instanceof Error))
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
  });

  it('should return error when signal is unknown', async () => {
    await vol.promises.writeFile(
      stdoutPath,
      JSON.stringify({
        ...runnerOutput,
        signal: 999,
      }),
    );

    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 200,
    } satisfies ProcessOutput);

    const result = await strategy.execute(mockCtxNoArg, signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner exited with unknown signal {signal},999');
    if (!(result instanceof Error))
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
  });

  it('should perform soft kill when time limit is exceeded', async () => {
    await vol.promises.writeFile(
      stdoutPath,
      JSON.stringify({
        ...runnerOutput,
        killed: true,
      }),
    );

    executorMock.spawn.mockReturnValue(processHandleMock);

    let resolveWait: (value: ProcessExecuteResult) => void;
    const waitPromise = new Promise<ProcessExecuteResult>((resolve) => {
      resolveWait = resolve;
    });
    processHandleMock.wait.mockReturnValue(waitPromise);
    processHandleMock.writeStdin.mockImplementation((data) => {
      if (data === 'k') {
        loggerMock.info(`Received soft kill signal in mock`);
        resolveWait({
          codeOrSignal: 0,
          stdoutPath,
          stderrPath,
          timeMs: 1000,
        } satisfies ProcessOutput);
      }
    });

    const resultPromise = strategy.execute(mockCtxNoArg, signal);
    await vi.advanceTimersByTimeAsync(
      mockCtxNoArg.timeLimitMs + settingsMock.runner.timeAddition + 100,
    );
    const result = await resultPromise;

    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: TempStorageMock.getPath(0),
      stderrPath: TempStorageMock.getPath(1),
      timeMs: 100,
      memoryMb: 10,
      isUserAborted: false,
    } satisfies ExecutionData);
    if (!(result instanceof Error))
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
  });

  it('should return error if runner provider fails', async () => {
    runnerProviderMock.getRunnerPath.mockRejectedValue(new Error('No runner binary'));

    const result = await strategy.execute(mockCtxNoArg, signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals(
      'Failed to prepare runner utility: {codeOrSignal},No runner binary',
    );
    tempStorageMock.checkFile();
  });

  it('should return error if runner process fails to start', async () => {
    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue(new Error('Process failed'));

    const result = await strategy.execute(mockCtxNoArg, signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Process failed');
    tempStorageMock.checkFile();
  });

  it('should return error if runner returns non-zero exit code', async () => {
    const stdoutData = {
      error: true,
      errorType: 1,
      errorCode: 101,
    } satisfies RunnerOutput;
    await vol.promises.writeFile(stdoutPath, JSON.stringify(stdoutData));

    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 1,
      stdoutPath,
      stderrPath,
      timeMs: 1000,
    } satisfies ProcessOutput);

    const result = await strategy.execute(mockCtxNoArg, signal);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner exited with code {codeOrSignal},1');
    tempStorageMock.checkFile();
  });

  it('should return error if runner output is malformed JSON', async () => {
    await vol.promises.writeFile(stdoutPath, invalidJson);

    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 1000,
    } satisfies ProcessOutput);

    const result = await strategy.execute(mockCtxNoArg, signal);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner output is invalid JSON');
    tempStorageMock.checkFile();
  });

  it('should return error if runner reports an internal error', async () => {
    const stdoutData = {
      error: true,
      errorType: 1,
      errorCode: 101,
    } satisfies RunnerOutput;
    await vol.promises.writeFile(stdoutPath, JSON.stringify(stdoutData));

    executorMock.spawn.mockReturnValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 1000,
    });

    const result = await strategy.execute(mockCtxNoArg, signal);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner reported error: {type} (Code: {code}),1,101');
    tempStorageMock.checkFile();
  });

  it('should handle User Abort correctly', async () => {
    const stdoutData = {
      error: false,
      killed: true,
      time: 50,
      memory: 1,
      exitCode: 0,
      signal: 9,
    } satisfies RunnerOutput;
    await vol.promises.writeFile(stdoutPath, JSON.stringify(stdoutData));

    executorMock.spawn.mockReturnValue(processHandleMock);

    let resolveWait: (value: ProcessExecuteResult) => void;
    processHandleMock.wait.mockReturnValue(
      new Promise((resolve) => {
        resolveWait = resolve;
      }),
    );
    processHandleMock.writeStdin.mockImplementation((data) => {
      if (data === 'k') {
        resolveWait({
          codeOrSignal: 0,
          stdoutPath,
          stderrPath,
          timeMs: 1000,
        });
      }
    });

    const ac = new AbortController();
    const resultPromise = strategy.execute(mockCtxNoArg, ac.signal);
    setTimeout(() => ac.abort(), 200);
    await vi.advanceTimersToNextTimerAsync();
    const result = await resultPromise;

    expect(result).not.toBeInstanceOf(Error);
    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.isUserAborted).toBe(true);
      expect(result.timeMs).toBe(50);
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });
});

describe.runIf(hasCppCompiler)('ExternalRunnerStrategy Real Integration', () => {
  const inputFile = 'input.in';
  let mockRunnerPath: string;
  let strategy: ExternalRunnerStrategy;
  let testWorkspace: string;
  let runnerProviderMock: MockProxy<IRunnerProvider>;

  const register = () => {
    container.registerInstance(TOKENS.extensionPath, extensionPathMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.compilationOutputChannel, compilationOutputChannelMock);

    container.registerSingleton(TOKENS.clock, ClockAdapter);
    container.registerSingleton(TOKENS.crypto, CryptoAdapter);
    container.registerSingleton(TOKENS.fileSystem, FileSystemAdapter);
    container.registerSingleton(TOKENS.path, PathAdapter);
    container.registerSingleton(TOKENS.pathResolver, PathResolverMock);
    container.registerSingleton(TOKENS.processExecutor, ProcessExecutorAdapter);
    container.registerSingleton(TOKENS.languageRegistry, LanguageRegistry);
    container.registerSingleton(TOKENS.runnerProvider, RunnerProviderAdapter);
    container.registerSingleton(TOKENS.system, SystemAdapter);
    container.registerSingleton(TOKENS.tempStorage, TempStorageAdapter);

    container.register(TOKENS.languageStrategy, { useClass: LangCpp });
  };

  beforeAll(async () => {
    register();
    const runnerProvider = container.resolve(RunnerProviderAdapter);
    mockRunnerPath = await runnerProvider.getRunnerPath(signal);
  });

  beforeEach(async () => {
    settingsMock.cache.directory = testWorkspace = createTestWorkspace();
    writeFileSync(join(testWorkspace, inputFile), '');
    settingsMock.runner.timeAddition = 100;

    runnerProviderMock = mock<IRunnerProvider>();
    runnerProviderMock.getRunnerPath.mockResolvedValue(mockRunnerPath);

    register();
    container.registerInstance(TOKENS.runnerProvider, runnerProviderMock);

    strategy = container.resolve(ExternalRunnerStrategy);
  });

  afterEach(() => {
    cleanupTestWorkspace(testWorkspace);
  });

  it('should execute a real program through the real runner binary', async () => {
    const scriptPath = createJsExecutable(testWorkspace, 'console.log("hello_from_node")');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs,
    };
    const result = await strategy.execute(ctx, signal);

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(result.isUserAborted).toBe(false);
      expect(result.stdoutPath).toMatch(new RegExp(`^${testWorkspace}`));
      expect(result.stderrPath).toMatch(new RegExp(`^${testWorkspace}`));
      expect(result.timeMs).toBeGreaterThan(0);
      const output = await readFile(result.stdoutPath, 'utf-8');
      expect(output.trim()).toBe('hello_from_node');
    }
  });

  it('should successfully perform a "Soft Kill" on the real runner binary', async () => {
    const scriptPath = createJsExecutable(testWorkspace, 'while (true) {}');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs,
    };

    const result = await strategy.execute(ctx, signal);

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe('SIGKILL');
      expect(result.isUserAborted).toBe(false);
      expect(result.timeMs).toBeGreaterThanOrEqual(
        ctx.timeLimitMs + settingsMock.runner.timeAddition,
      );
    }
  });

  it('should handle User Abort by sending "k" to the real runner', async () => {
    const scriptPath = createJsExecutable(testWorkspace, 'while (true) {}');
    const ctx: ExecutionContext = {
      cmd: [scriptPath],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs,
    };

    const ac = new AbortController();
    const promise = strategy.execute(ctx, ac.signal);
    setTimeout(() => ac.abort(), 200);

    const result = await promise;

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe('SIGKILL');
      expect(result.isUserAborted).toBe(true);
      expect(result.timeMs).toBeGreaterThan(150);
      expect(result.timeMs).toBeLessThan(300);
    }
  });

  it('should handle unlimited stack', async () => {
    const path = await createCppExecutable(testWorkspace, stackCode);

    const ctx: ExecutionContext = {
      cmd: [path],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs,
    };

    const res1 = await strategy.execute(ctx, signal);
    expect(res1).not.toBeInstanceOf(Error);
    if (!(res1 instanceof Error)) {
      expect(res1.codeOrSignal).toBe('SIGSEGV');
      expect(res1.isUserAborted).toBe(false);
    }

    settingsMock.runner.unlimitedStack = true;
    const res2 = await strategy.execute(ctx, signal);
    expect(res2).not.toBeInstanceOf(Error);
    if (!(res2 instanceof Error)) {
      expect(res2.codeOrSignal).toBe('SIGKILL');
      expect(res2.isUserAborted).toBe(false);
    }
  });
});

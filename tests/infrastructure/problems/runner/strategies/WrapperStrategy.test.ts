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

import { join } from 'node:path';
import { hasCppCompiler } from '@t/check';
import sleep200Code from '@t/fixtures/sleep200.cpp?raw';
import stackCode from '@t/fixtures/stack.cpp?raw';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import {
  cleanupTestWorkspace,
  createCppExecutable,
  createTestWorkspace,
  invalidJson,
  mockCtx,
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
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessExecuteResult,
  type ProcessOutput,
} from '@/application/ports/node/IProcessExecutor';
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
  type WrapperData,
  WrapperStrategy,
} from '@/infrastructure/problems/judge/runner/strategies/wrapperStrategy';

describe('WrapperStrategy', () => {
  let strategy: WrapperStrategy;
  let executorMock: MockProxy<IProcessExecutor>;
  let fileSystemMock: MockProxy<IFileSystem>;
  let tempStorageMock: TempStorageMock;
  let vol: Volume;

  beforeEach(() => {
    ({ fileSystemMock, vol } = createFileSystemMock());
    fileSystemMock.safeCreateFile(stdinPath);
    fileSystemMock.safeCreateFile(solutionPath);
    executorMock = mock<IProcessExecutor>();

    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);

    strategy = container.resolve(WrapperStrategy);
    tempStorageMock = container.resolve(TOKENS.tempStorage) as TempStorageMock;
  });

  it('should successfully extract time', async () => {
    await vol.promises.writeFile(
      TempStorageMock.getPath(0),
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
    if (!(result instanceof Error)) tempStorageMock.checkFile();
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
    if (!(result instanceof Error)) tempStorageMock.checkFile();
  });

  it('should handle UserAbort correctly', async () => {
    await vol.promises.writeFile(
      TempStorageMock.getPath(0),
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
    if (!(result instanceof Error)) tempStorageMock.checkFile();
  });

  it('should return error if executor fails', async () => {
    const execError = new Error('Execution failed');
    executorMock.execute.mockResolvedValue(execError);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).toBe(execError);
  });

  it('should handle malformed JSON in wrapper data gracefully', async () => {
    await vol.promises.writeFile(TempStorageMock.getPath(0), invalidJson);
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 300,
    } satisfies ProcessOutput);

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
    if (!(result instanceof Error)) tempStorageMock.checkFile();
  });

  it('should call executor with correct timeout addition', async () => {
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 100,
    } satisfies ProcessOutput);

    await strategy.execute(mockCtx, signal);

    expect(executorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: mockCtx.timeLimitMs + settingsMock.runner.timeAddition,
      }),
    );
    tempStorageMock.checkFile();
  });

  it('should warn and fallback if report file exists but is empty', async () => {
    await vol.promises.writeFile(TempStorageMock.getPath(0), '');
    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath,
      stderrPath,
      timeMs: 400,
    } satisfies ProcessOutput);

    const result = await strategy.execute(mockCtx, signal);

    expect(result).not.toBeInstanceOf(Error);
    expect((result as ExecutionData).timeMs).toBe(400);
    expect(loggerMock.warn).toHaveBeenCalledWith('Wrapper report is empty');
  });
});

describe.runIf(hasCppCompiler)('WrapperStrategy Real Integration', { retry: 3 }, () => {
  const inputFile = 'input.in';
  let testWorkspace: string;
  let strategy: WrapperStrategy;

  beforeEach(() => {
    settingsMock.cache.directory = testWorkspace = createTestWorkspace();
    settingsMock.compilation.useWrapper = true;

    container.registerInstance(TOKENS.compilationOutputChannel, compilationOutputChannelMock);
    container.registerInstance(TOKENS.extensionPath, extensionPathMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerInstance(TOKENS.translator, translatorMock);

    container.registerSingleton(TOKENS.clock, ClockAdapter);
    container.registerSingleton(TOKENS.crypto, CryptoAdapter);
    container.registerSingleton(TOKENS.fileSystem, FileSystemAdapter);
    container.registerSingleton(TOKENS.languageRegistry, LanguageRegistry);
    container.registerSingleton(TOKENS.path, PathAdapter);
    container.registerSingleton(TOKENS.pathResolver, PathResolverMock);
    container.registerSingleton(TOKENS.processExecutor, ProcessExecutorAdapter);
    container.registerSingleton(TOKENS.system, SystemAdapter);
    container.registerSingleton(TOKENS.tempStorage, TempStorageAdapter);

    container.register(TOKENS.languageStrategy, { useClass: LangCpp });

    strategy = container.resolve(WrapperStrategy);
  });

  afterEach(() => {
    cleanupTestWorkspace(testWorkspace);
  });

  it('should correctly execute and measure time', async () => {
    const path = await createCppExecutable(testWorkspace, sleep200Code);

    const ctx: ExecutionContext = {
      cmd: [path],
      stdinPath: join(testWorkspace, inputFile),
      timeLimitMs,
    };
    const result = await strategy.execute(ctx, signal);
    expect(result).not.toBeInstanceOf(Error);
    if (result instanceof Error) return;

    expect(result.codeOrSignal).toBe(0);
    console.log(result.timeMs);
    expect(result.timeMs).toBeGreaterThanOrEqual(200);
    expect(result.timeMs).toBeLessThan(201);
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
      expect(res2.codeOrSignal).toBe('SIGTERM');
      expect(res2.isUserAborted).toBe(false);
    }
  });
});

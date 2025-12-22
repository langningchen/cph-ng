import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PathRendererMock } from '@t/infrastructure/services/pathRendererMock';
import { SettingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { ExtensionContext } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type {
  IProcessExecutor,
  ProcessExecuteResult,
  ProcessHandle,
  ProcessOutput,
} from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IRunnerProvider } from '@/application/ports/problems/IRunnerProvider';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { RunnerProviderAdapter } from '@/infrastructure/problems/runner/runnerProviderAdapter';
import { ExternalRunnerStrategy } from '@/infrastructure/problems/runner/strategies/ExternalRunnerStrategy';

describe('ExternalRunnerStrategy', () => {
  let strategy: ExternalRunnerStrategy;
  let loggerMock: MockProxy<ILogger>;
  let telemetryMock: MockProxy<ITelemetry>;
  let fsMock: MockProxy<IFileSystem>;
  let executorMock: MockProxy<IProcessExecutor>;
  let tmpMock: MockProxy<ITempStorage>;
  let translatorMock: MockProxy<ITranslator>;
  let runnerProviderMock: MockProxy<IRunnerProvider>;
  let processHandleMock: MockProxy<ProcessHandle>;

  const MOCK_RUNNER_PATH = '/path/to/runner';

  beforeEach(() => {
    vi.useFakeTimers();

    loggerMock = mock<ILogger>();
    telemetryMock = mock<ITelemetry>();
    fsMock = mock<IFileSystem>();
    executorMock = mock<IProcessExecutor>();
    tmpMock = mock<ITempStorage>();
    translatorMock = mock<ITranslator>();
    runnerProviderMock = mock<IRunnerProvider>();
    processHandleMock = mock<ProcessHandle>();

    loggerMock.withScope.mockReturnValue(loggerMock);
    translatorMock.t.mockImplementation((key, ...args) =>
      [key, ...args].join(','),
    );
    runnerProviderMock.getRunnerPath.mockResolvedValue(MOCK_RUNNER_PATH);

    let tmpIdx = 0;
    tmpMock.create.mockImplementation(() => `/tmp/file-${tmpIdx++}`);

    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.ProcessExecutor, executorMock);
    container.registerInstance(TOKENS.TempStorage, tmpMock);
    container.registerInstance(TOKENS.Translator, translatorMock);
    container.registerInstance(TOKENS.RunnerProvider, runnerProviderMock);
    container.registerSingleton(TOKENS.Settings, SettingsMock);
    container.registerSingleton(TOKENS.PathRenderer, PathRendererMock);

    strategy = container.resolve(ExternalRunnerStrategy);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.clearInstances();
  });

  const mockCtx: ExecutionContext = {
    cmd: ['g++', 'main.cpp'],
    stdin: { useFile: false, data: 'input_data' },
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

    const resultPromise = strategy.execute(mockCtx, new AbortController());
    const result = await resultPromise;

    expect(executorMock.spawn).toHaveBeenCalled();
    expect(fsMock.safeWriteFile).toHaveBeenCalled();
    expect(result).not.toBeInstanceOf(Error);
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
      console.log('called wait');
      resolveWait = resolve;
    });
    processHandleMock.wait.mockReturnValue(waitPromise);
    processHandleMock.writeStdin.mockImplementation((data) => {
      console.log(`stdin: ${data}`);
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

    const resultPromise = strategy.execute(mockCtx, new AbortController());
    await vi.advanceTimersByTimeAsync(
      mockCtx.timeLimitMs + new SettingsMock().runner.timeAddition + 100,
    );
    const result = await resultPromise;

    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.isAborted).toBe(false);
      expect(result.timeMs).toBe(1200);
    }
  });

  it('should return error if runner provider fails', async () => {
    runnerProviderMock.getRunnerPath.mockRejectedValue(
      new Error('No runner binary'),
    );

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals(
      'Failed to prepare runner utility: {0},No runner binary',
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

    const result = await strategy.execute(mockCtx, new AbortController());

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).equals('Runner exited with code {0},1');
  });

  it('should throw error if runner output is malformed JSON', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 1000,
    });
    fsMock.readFile.mockResolvedValue('invalid-json');

    await expect(
      strategy.execute(mockCtx, new AbortController()),
    ).rejects.toThrow('Runner output is invalid JSON');

    expect(telemetryMock.error).toHaveBeenCalledWith(
      'parseRunnerError',
      expect.any(Error),
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

    await expect(
      strategy.execute(mockCtx, new AbortController()),
    ).rejects.toThrow('Runner reported error: {0} (Code: {1}),1,101');
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
    const resultPromise = strategy.execute(mockCtx, ac);
    setImmediate(() => {
      ac.abort();
    });
    await vi.advanceTimersToNextTimerAsync();
    const result = await resultPromise;

    expect(processHandleMock.writeStdin).toHaveBeenCalledWith('k');
    expect(processHandleMock.closeStdin).toHaveBeenCalled();
    if (!(result instanceof Error)) {
      expect(result.isAborted).toBe(true);
      expect(result.timeMs).toBe(50);
    }
  });

  it('should dispose temporary files created for stdin if not using file mode', async () => {
    executorMock.spawn.mockResolvedValue(processHandleMock);
    processHandleMock.wait.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/out',
      stderrPath: '/tmp/err',
      timeMs: 1000,
    });
    fsMock.readFile.mockResolvedValue(
      JSON.stringify({ error: false, time: 1 }),
    );

    await strategy.execute(mockCtx, new AbortController());

    expect(tmpMock.dispose).toHaveBeenCalledWith('/tmp/file-0');
  });
});

describe('ExternalRunnerStrategy Real Integration', () => {
  let strategy: ExternalRunnerStrategy;
  let testWorkspace: string;

  // Mocks for UI/Telemetry (Keep these mocked to avoid VS Code dependency)
  const loggerMock = mock<ILogger>();
  const telemetryMock = mock<ITelemetry>();
  const translatorMock = mock<ITranslator>();
  const ctxMock = mock<ExtensionContext>({
    extensionPath: '/home/langningchen/cph-ng',
  });
  const settingsMock = mock<ISettings>({
    runner: { timeAddition: 200, unlimitedStack: false },
  });

  beforeEach(async () => {
    // 2. Setup real test workspace
    testWorkspace = join(tmpdir(), `cph-real-test-${Date.now()}`);
    mkdirSync(testWorkspace, { recursive: true });
    const cacheDir = join(testWorkspace, 'cache');
    mkdirSync(cacheDir);
    settingsMock.cache.directory = cacheDir;

    // 3. Configure Mocks
    loggerMock.withScope.mockReturnValue(loggerMock);
    translatorMock.t.mockImplementation(
      (key, ...args) => `${key}:${args.join(',')}`,
    );

    // 4. Register REAL implementations in the container
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerInstance(TOKENS.Translator, translatorMock);
    container.registerInstance(TOKENS.ExtensionContext, ctxMock);

    container.registerSingleton(TOKENS.Settings, SettingsMock);
    container.registerSingleton(TOKENS.RunnerProvider, RunnerProviderAdapter);
    container.registerSingleton(TOKENS.System, SystemAdapter);
    container.registerSingleton(TOKENS.ProcessExecutor, ProcessExecutorAdapter);
    container.registerSingleton(TOKENS.TempStorage, TempStorageAdapter);
    container.registerSingleton(TOKENS.FileSystem, FileSystemAdapter);
    container.registerSingleton(TOKENS.Clock, ClockAdapter);
    container.registerSingleton(TOKENS.PathRenderer, PathRendererMock);
    container.registerSingleton(TOKENS.Crypto, CryptoAdapter);

    strategy = container.resolve(ExternalRunnerStrategy);
  });

  afterEach(() => {
    container.clearInstances();
    if (testWorkspace) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  it('should execute a real program through the real runner binary', async () => {
    // Context: run a simple node command that prints "hello"
    const ctx: ExecutionContext = {
      cmd: ['node', '-e', 'console.log("hello_from_node")'],
      stdin: { useFile: false, data: '' },
      timeLimitMs: 2000,
    };

    const result = await strategy.execute(ctx, new AbortController());
    console.log(result);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(result.timeMs).toBeGreaterThan(0);

      // Verify actual output from the file created by the runner
      const output = readFileSync(result.stdoutPath, 'utf-8');
      expect(output.trim()).toBe('hello_from_node');
    }
  });

  it('should successfully perform a "Soft Kill" on the real runner binary', async () => {
    // Context: a command that runs forever
    const ctx: ExecutionContext = {
      cmd: ['node', '-e', 'setInterval(()=>{}, 1000)'],
      stdin: { useFile: false, data: '' },
      timeLimitMs: 500, // Short time limit to trigger timeout
    };

    const result = await strategy.execute(ctx, new AbortController());

    // In a real TLE scenario, the runner should respond to 'k' and exit
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      // The exact field depends on your Runner's JSON output
      expect(result.isAborted).toBe(false); // Because it was a Timeout, not User Abort
      expect(result.timeMs).toBeGreaterThanOrEqual(500);
    }
  });

  it('should handle User Abort by sending "k" to the real runner', async () => {
    const ctx: ExecutionContext = {
      cmd: ['node', '-e', 'setInterval(()=>{}, 1000)'],
      stdin: { useFile: false, data: '' },
      timeLimitMs: 10000,
    };

    const ac = new AbortController();
    const promise = strategy.execute(ctx, ac);

    // Manually abort after 200ms
    setTimeout(() => ac.abort(), 200);

    const result = await promise;

    if (!(result instanceof Error)) {
      expect(result.isAborted).toBe(true);
      expect(result.timeMs).toBeLessThan(1000);
    }
  });
});

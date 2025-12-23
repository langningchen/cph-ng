import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { anyNumber, type MockProxy, mock } from 'vitest-mock-extended';
import {
  AbortReason,
  type IProcessExecutor,
} from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionContext } from '@/domain/execution';
import { NormalStrategy } from '@/infrastructure/problems/runner/strategies/NormalStrategy';

describe('NormalStrategy', () => {
  let strategy: NormalStrategy;
  let executorMock: MockProxy<IProcessExecutor>;

  beforeEach(() => {
    executorMock = mock<IProcessExecutor>();

    container.registerInstance(TOKENS.ProcessExecutor, executorMock);
    container.registerInstance(TOKENS.Settings, settingsMock);

    strategy = container.resolve(NormalStrategy);
  });

  const executionContext: ExecutionContext = {
    cmd: ['echo', 'hello'],
    stdin: { useFile: false, data: 'test_input' },
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

    const abortController = new AbortController();
    const result = await strategy.execute(executionContext, abortController);

    expect(executorMock.execute).toHaveBeenCalledWith({
      cmd: executionContext.cmd,
      timeoutMs: anyNumber(),
      stdin: executionContext.stdin,
      ac: abortController,
    });

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(result.isAborted).toBe(false);
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

    const result = await strategy.execute(
      executionContext,
      new AbortController(),
    );

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.isAborted).toBe(true);
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

    const result = await strategy.execute(
      executionContext,
      new AbortController(),
    );

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.isAborted).toBe(false);
    }
  });

  it('should passthrough the error if the executor returns an Error object', async () => {
    const executionError = new Error('Executable not found');
    executorMock.execute.mockResolvedValue(executionError);

    const result = await strategy.execute(
      executionContext,
      new AbortController(),
    );

    expect(result).toBeInstanceOf(Error);
    expect(result).toBe(executionError);
  });
});

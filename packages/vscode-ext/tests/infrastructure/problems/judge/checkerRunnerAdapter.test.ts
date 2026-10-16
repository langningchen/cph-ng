import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { executorMock } from '@t/infrastructure/node/processExecutorMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ProcessOutput } from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import { CheckerRunnerAdapter } from '@/infrastructure/problems/judge/checkerRunnerAdapter';

describe('CheckerRunnerAdapter', () => {
  let runner: CheckerRunnerAdapter;
  let fileSystemMock: MockProxy<IFileSystem>;
  const signal = new AbortController().signal;

  beforeEach(() => {
    ({ fileSystemMock } = createFileSystemMock());
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);

    runner = container.resolve(CheckerRunnerAdapter);
  });

  it('should return exitCode and message on successful checker run', async () => {
    const stderrPath = '/tmp/checker-stderr';
    await fileSystemMock.safeWriteFile(stderrPath, 'ok checker message');

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/checker-stdout',
      stderrPath,
      timeMs: 50,
    } satisfies ProcessOutput);

    const result = await runner.run(
      {
        checkerPath: '/checker',
        inputPath: '/input',
        outputPath: '/output',
        answerPath: '/answer',
      },
      signal,
    );

    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.exitCode).toBe(0);
      expect(result.msg).toBe('ok checker message');
    }
  });

  it('should return Error when executor returns Error', async () => {
    executorMock.execute.mockResolvedValue(new Error('spawn failed'));

    const result = await runner.run(
      {
        checkerPath: '/checker',
        inputPath: '/input',
        outputPath: '/output',
        answerPath: '/answer',
      },
      signal,
    );

    expect(result).toBeInstanceOf(Error);
  });

  it('should return Error when checker exits with signal', async () => {
    const stderrPath = '/tmp/checker-stderr';
    await fileSystemMock.safeWriteFile(stderrPath, '');

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 'SIGSEGV',
      stdoutPath: '/tmp/checker-stdout',
      stderrPath,
      timeMs: 50,
    } satisfies ProcessOutput);

    const result = await runner.run(
      {
        checkerPath: '/checker',
        inputPath: '/input',
        outputPath: '/output',
        answerPath: '/answer',
      },
      signal,
    );

    expect(result).toBeInstanceOf(Error);
  });

  it('should pass correct arguments to executor', async () => {
    const stderrPath = '/tmp/checker-stderr';
    await fileSystemMock.safeWriteFile(stderrPath, '');

    executorMock.execute.mockResolvedValue({
      codeOrSignal: 0,
      stdoutPath: '/tmp/checker-stdout',
      stderrPath,
      timeMs: 50,
    } satisfies ProcessOutput);

    await runner.run(
      {
        checkerPath: '/my/checker',
        inputPath: '/my/input',
        outputPath: '/my/output',
        answerPath: '/my/answer',
      },
      signal,
    );

    expect(executorMock.execute).toHaveBeenCalledWith({
      cmd: ['/my/checker', '/my/input', '/my/output', '/my/answer'],
      signal,
    });
  });
});

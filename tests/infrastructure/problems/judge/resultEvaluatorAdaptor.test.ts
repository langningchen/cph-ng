import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ICheckerRunner } from '@/application/ports/problems/judge/ICheckerRunner';
import { TOKENS } from '@/composition/tokens';
import { VerdictName } from '@/domain/entities/verdict';
import type { ExecutionData } from '@/domain/execution';
import { ResultEvaluatorAdaptor } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';

describe('ResultEvaluatorAdaptor', () => {
  let evaluator: ResultEvaluatorAdaptor;
  let fileSystemMock: MockProxy<IFileSystem>;
  let checkerRunnerMock: MockProxy<ICheckerRunner>;
  const signal = new AbortController().signal;

  const makeExecResult = (overrides: Partial<ExecutionData> = {}): ExecutionData => ({
    codeOrSignal: 0,
    stdoutPath: '/tmp/stdout',
    stderrPath: '/tmp/stderr',
    timeMs: 100,
    isUserAborted: false,
    ...overrides,
  });

  beforeEach(() => {
    ({ fileSystemMock } = createFileSystemMock());
    checkerRunnerMock = mock<ICheckerRunner>();

    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.checkerRunner, checkerRunnerMock);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);

    evaluator = container.resolve(ResultEvaluatorAdaptor);
  });

  it('should return rejected when user aborted', async () => {
    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ isUserAborted: true }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.rejected);
  });

  it('should return TLE when time exceeds limit', async () => {
    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ timeMs: 2000 }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.timeLimitExceed);
    expect(result.timeMs).toBe(2000);
  });

  it('should return MLE when memory exceeds limit', async () => {
    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ memoryMb: 1024 }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 10000,
        memoryLimitMb: 512,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.memoryLimitExceed);
  });

  it('should return RE when codeOrSignal is non-zero', async () => {
    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ codeOrSignal: 1 }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.runtimeError);
    expect(result.msg).toContain('1');
  });

  it('should return RE when codeOrSignal is a signal string', async () => {
    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ codeOrSignal: 'SIGSEGV' }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.runtimeError);
  });

  it('should use checker when checkerPath is provided', async () => {
    checkerRunnerMock.run.mockResolvedValue({ exitCode: 0, msg: 'ok' });

    const result = await evaluator.judge(
      {
        executionResult: makeExecResult(),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        checkerPath: '/tmp/checker',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.accepted);
    expect(result.msg).toBe('ok');
  });

  it('should return SE when checker returns error', async () => {
    checkerRunnerMock.run.mockResolvedValue(new Error('Checker crashed'));

    const result = await evaluator.judge(
      {
        executionResult: makeExecResult(),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        checkerPath: '/tmp/checker',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.systemError);
    expect(result.msg).toBe('Checker crashed');
  });

  it('should use string comparison when no checker and no interactor', async () => {
    await fileSystemMock.safeWriteFile('/tmp/stdout', 'hello\n');
    await fileSystemMock.safeWriteFile('/tmp/ans', 'hello\n');
    await fileSystemMock.safeWriteFile('/tmp/stderr', '');

    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ stdoutPath: '/tmp/stdout', stderrPath: '/tmp/stderr' }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.accepted);
  });

  it('should return WA when output does not match answer', async () => {
    await fileSystemMock.safeWriteFile('/tmp/stdout', 'wrong');
    await fileSystemMock.safeWriteFile('/tmp/ans', 'correct');
    await fileSystemMock.safeWriteFile('/tmp/stderr', '');

    const result = await evaluator.judge(
      {
        executionResult: makeExecResult({ stdoutPath: '/tmp/stdout', stderrPath: '/tmp/stderr' }),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.wrongAnswer);
  });

  it('should handle interactor result', async () => {
    await fileSystemMock.safeWriteFile('/tmp/feedback', 'ok feedback');
    await fileSystemMock.safeWriteFile('/tmp/int-stdout', '');
    await fileSystemMock.safeWriteFile('/tmp/int-stderr', '');

    const result = await evaluator.judge(
      {
        executionResult: makeExecResult(),
        inputPath: '/tmp/in',
        answerPath: '/tmp/ans',
        interactorResult: {
          execution: makeExecResult({
            codeOrSignal: 0,
            stdoutPath: '/tmp/int-stdout',
            stderrPath: '/tmp/int-stderr',
          }),
          feedback: '/tmp/feedback',
        },
        timeLimitMs: 1000,
      },
      signal,
    );
    expect(result.verdict).toBe(VerdictName.accepted);
    expect(result.msg).toBe('ok feedback');
  });
});

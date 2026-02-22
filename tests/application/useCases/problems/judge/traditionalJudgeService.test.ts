import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { IResultEvaluator } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import { TraditionalJudgeService } from '@/application/useCases/problems/judge/traditionalJudgeService';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { VerdictName } from '@/domain/entities/verdict';
import { type ExecutionData, ExecutionRejected } from '@/domain/execution';

describe('TraditionalJudgeService', () => {
  let service: TraditionalJudgeService;
  let runnerMock: MockProxy<ISolutionRunner>;
  let evaluatorMock: MockProxy<IResultEvaluator>;
  let langRegistryMock: MockProxy<ILanguageRegistry>;
  let problemServiceMock: MockProxy<IProblemService>;
  let testcaseIoServiceMock: MockProxy<ITestcaseIoService>;
  let observerMock: MockProxy<IJudgeObserver>;
  const signal = new AbortController().signal;

  beforeEach(() => {
    runnerMock = mock<ISolutionRunner>();
    evaluatorMock = mock<IResultEvaluator>();
    langRegistryMock = mock<ILanguageRegistry>();
    problemServiceMock = mock<IProblemService>();
    testcaseIoServiceMock = mock<ITestcaseIoService>();
    observerMock = mock<IJudgeObserver>();

    container.registerInstance(TOKENS.resultEvaluator, evaluatorMock);
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);
    container.registerInstance(TOKENS.problemService, problemServiceMock);
    container.registerInstance(TOKENS.solutionRunner, runnerMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.testcaseIoService, testcaseIoServiceMock);

    observerMock.onStatusChange.mockReturnValue(undefined);
    observerMock.onResult.mockReturnValue(undefined);
    observerMock.onError.mockReturnValue(undefined);

    service = container.resolve(TraditionalJudgeService);
  });

  const makeProblem = () => {
    const problem = new Problem('test', '/src/main.cpp');
    return problem;
  };

  const makeCtx = () => ({
    problem: makeProblem(),
    stdinPath: '/tmp/stdin',
    answerPath: '/tmp/answer',
    artifacts: {
      solution: { path: '/tmp/solution' },
    },
  });

  it('should judge successfully and call observer callbacks', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    const execResult: ExecutionData = {
      codeOrSignal: 0,
      stdoutPath: '/tmp/stdout',
      stderrPath: '/tmp/stderr',
      timeMs: 100,
      isUserAborted: false,
    };
    runnerMock.run.mockResolvedValue(execResult);

    evaluatorMock.judge.mockResolvedValue({
      verdict: VerdictName.accepted,
      timeMs: 100,
    });

    const inlinedStdout = new TestcaseIo({ data: 'output' });
    const inlinedStderr = new TestcaseIo({ data: '' });
    testcaseIoServiceMock.tryInlining.mockResolvedValueOnce(inlinedStdout);
    testcaseIoServiceMock.tryInlining.mockResolvedValueOnce(inlinedStderr);

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.judging);
    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.judged);
    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.comparing);
    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.accepted }),
    );
  });

  it('should call onResult with rejected when lang is not found', async () => {
    langRegistryMock.getLang.mockReturnValue(undefined);

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.rejected }),
    );
  });

  it('should call onResult with rejected when runner returns ExecutionRejected', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    runnerMock.run.mockResolvedValue(new ExecutionRejected('rejected'));

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.rejected }),
    );
  });

  it('should call onError when runner throws unexpected error', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    const error = new Error('unexpected');
    runnerMock.run.mockRejectedValue(error);

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onError).toHaveBeenCalledWith(error);
  });
});

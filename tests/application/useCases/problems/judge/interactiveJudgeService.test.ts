import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { IResultEvaluator } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import { InteractiveJudgeService } from '@/application/useCases/problems/judge/interactiveJudgeService';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { VerdictName } from '@/domain/entities/verdict';
import { ExecutionRejected, type InteractiveExecutionResult } from '@/domain/execution';

describe('InteractiveJudgeService', () => {
  let service: InteractiveJudgeService;
  let runnerMock: MockProxy<ISolutionRunner>;
  let evaluatorMock: MockProxy<IResultEvaluator>;
  let langRegistryMock: MockProxy<ILanguageRegistry>;
  let problemServiceMock: MockProxy<IProblemService>;
  let observerMock: MockProxy<IJudgeObserver>;
  const signal = new AbortController().signal;

  beforeEach(() => {
    runnerMock = mock<ISolutionRunner>();
    evaluatorMock = mock<IResultEvaluator>();
    langRegistryMock = mock<ILanguageRegistry>();
    problemServiceMock = mock<IProblemService>();
    observerMock = mock<IJudgeObserver>();

    container.registerInstance(TOKENS.resultEvaluator, evaluatorMock);
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);
    container.registerInstance(TOKENS.problemService, problemServiceMock);
    container.registerInstance(TOKENS.solutionRunner, runnerMock);
    container.registerInstance(TOKENS.translator, translatorMock);

    observerMock.onStatusChange.mockReturnValue(undefined);
    observerMock.onResult.mockReturnValue(undefined);
    observerMock.onError.mockReturnValue(undefined);

    service = container.resolve(InteractiveJudgeService);
  });

  const makeCtx = () => {
    const problem = new Problem('test', '/src/main.cpp');
    problem.interactor = { path: '/interactor.cpp' };
    return {
      problem,
      stdinPath: '/tmp/stdin',
      answerPath: '/tmp/answer',
      artifacts: {
        solution: { path: '/tmp/solution' },
        interactor: { path: '/tmp/interactor-bin' },
      },
    };
  };

  it('should judge interactively and call observer', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    const interactiveResult: InteractiveExecutionResult = {
      sol: {
        codeOrSignal: 0,
        stdoutPath: '/tmp/sol-stdout',
        stderrPath: '/tmp/sol-stderr',
        timeMs: 50,
        isUserAborted: false,
      },
      int: {
        codeOrSignal: 0,
        stdoutPath: '/tmp/int-stdout',
        stderrPath: '/tmp/int-stderr',
        timeMs: 30,
        isUserAborted: false,
      },
      feedbackPath: '/tmp/feedback',
    };
    runnerMock.runInteractive.mockResolvedValue(interactiveResult);

    evaluatorMock.judge.mockResolvedValue({
      verdict: VerdictName.accepted,
      timeMs: 50,
    });

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.judging);
    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.judged);
    expect(observerMock.onStatusChange).toHaveBeenCalledWith(VerdictName.comparing);
    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.accepted }),
    );
  });

  it('should throw error when artifacts.interactor is missing', async () => {
    const ctx = makeCtx();
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid state
    ctx.artifacts.interactor = undefined as any;

    await service.judge(ctx, observerMock, signal);

    expect(observerMock.onError).toHaveBeenCalled();
  });

  it('should call onResult with rejected when lang is not found', async () => {
    langRegistryMock.getLang.mockReturnValue(undefined);

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.rejected }),
    );
  });

  it('should call onError when interactor execution returns Error', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    runnerMock.runInteractive.mockResolvedValue(new Error('interactor crashed'));

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onError).toHaveBeenCalled();
  });

  it('should call onResult with rejected when runner returns ExecutionRejected', async () => {
    const langMock = mock<ILanguageStrategy>();
    langMock.getRunCommand.mockResolvedValue(['./solution']);
    langRegistryMock.getLang.mockReturnValue(langMock);
    problemServiceMock.getLimits.mockReturnValue({ timeLimitMs: 1000, memoryLimitMb: 512 });

    runnerMock.runInteractive.mockRejectedValue(new ExecutionRejected('rejected'));

    await service.judge(makeCtx(), observerMock, signal);

    expect(observerMock.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: VerdictName.rejected }),
    );
  });
});

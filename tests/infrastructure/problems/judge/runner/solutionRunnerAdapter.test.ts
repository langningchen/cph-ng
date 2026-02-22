import { executorMock } from '@t/infrastructure/node/processExecutorMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IExecutionStrategyFactory } from '@/application/ports/problems/judge/runner/execution/IExecutionStrategyFactory';
import type { IExecutionStrategy } from '@/application/ports/problems/judge/runner/execution/strategies/IExecutionStrategy';
import { TOKENS } from '@/composition/tokens';
import { ExecutionRejected } from '@/domain/execution';
import { SolutionRunnerAdapter } from '@/infrastructure/problems/judge/runner/solutionRunnerAdapter';

describe('SolutionRunnerAdapter', () => {
  let runner: SolutionRunnerAdapter;
  let factoryMock: MockProxy<IExecutionStrategyFactory>;
  let tempMock: MockProxy<ITempStorage>;

  beforeEach(() => {
    factoryMock = mock<IExecutionStrategyFactory>();
    tempMock = mock<ITempStorage>();

    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.processExecutor, executorMock);
    container.registerInstance(TOKENS.tempStorage, tempMock);
    container.registerInstance(TOKENS.executionStrategyFactory, factoryMock);

    runner = container.resolve(SolutionRunnerAdapter);
  });

  describe('run', () => {
    const signal = new AbortController().signal;
    const ctx = { cmd: ['./solution'], stdinPath: '/tmp/stdin', timeLimitMs: 1000 };

    it('should use normal strategy by default', async () => {
      const strategyMock = mock<IExecutionStrategy>();
      strategyMock.execute.mockResolvedValue({
        codeOrSignal: 0,
        stdoutPath: '/tmp/out',
        stderrPath: '/tmp/err',
        timeMs: 100,
        isUserAborted: false,
      });
      factoryMock.create.mockReturnValue(strategyMock);

      await runner.run(ctx, signal);

      expect(factoryMock.create).toHaveBeenCalledWith('normal');
    });

    it('should use external strategy when useRunner is enabled', async () => {
      settingsMock.runner.useRunner = true;
      const strategyMock = mock<IExecutionStrategy>();
      strategyMock.execute.mockResolvedValue({
        codeOrSignal: 0,
        stdoutPath: '/tmp/out',
        stderrPath: '/tmp/err',
        timeMs: 100,
        isUserAborted: false,
      });
      factoryMock.create.mockReturnValue(strategyMock);

      await runner.run(ctx, signal);

      expect(factoryMock.create).toHaveBeenCalledWith('external');
    });

    it('should use wrapper strategy when useWrapper is enabled', async () => {
      settingsMock.compilation.useWrapper = true;
      const strategyMock = mock<IExecutionStrategy>();
      strategyMock.execute.mockResolvedValue({
        codeOrSignal: 0,
        stdoutPath: '/tmp/out',
        stderrPath: '/tmp/err',
        timeMs: 100,
        isUserAborted: false,
      });
      factoryMock.create.mockReturnValue(strategyMock);

      await runner.run(ctx, signal);

      expect(factoryMock.create).toHaveBeenCalledWith('wrapper');
    });

    it('should return ExecutionRejected when both useRunner and useWrapper are enabled', async () => {
      settingsMock.runner.useRunner = true;
      settingsMock.compilation.useWrapper = true;

      const result = await runner.run(ctx, signal);

      expect(result).toBeInstanceOf(ExecutionRejected);
    });
  });
});

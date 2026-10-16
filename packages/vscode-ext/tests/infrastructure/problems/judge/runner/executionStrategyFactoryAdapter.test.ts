import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExecutionStrategyFactoryAdapter } from '@/infrastructure/problems/judge/runner/executionStrategyFactoryAdapter';
import { ExternalRunnerStrategy } from '@/infrastructure/problems/judge/runner/strategies/externalRunnerStrategy';
import { NormalStrategy } from '@/infrastructure/problems/judge/runner/strategies/normalStrategy';
import { WrapperStrategy } from '@/infrastructure/problems/judge/runner/strategies/wrapperStrategy';

describe('ExecutionStrategyFactoryAdapter', () => {
  let factory: ExecutionStrategyFactoryAdapter;
  const normalMock = {} as NormalStrategy;
  const wrapperMock = {} as WrapperStrategy;
  const externalMock = {} as ExternalRunnerStrategy;

  beforeEach(() => {
    container.registerInstance(NormalStrategy, normalMock);
    container.registerInstance(WrapperStrategy, wrapperMock);
    container.registerInstance(ExternalRunnerStrategy, externalMock);
    factory = container.resolve(ExecutionStrategyFactoryAdapter);
  });

  it('should return normal strategy', () => {
    expect(factory.create('normal')).toBe(normalMock);
  });

  it('should return wrapper strategy', () => {
    expect(factory.create('wrapper')).toBe(wrapperMock);
  });

  it('should return external strategy', () => {
    expect(factory.create('external')).toBe(externalMock);
  });

  it('should throw for unknown strategy type', () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    expect(() => factory.create('unknown' as any)).toThrow('Unknown strategy type');
  });
});

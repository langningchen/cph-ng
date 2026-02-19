import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { InteractiveJudgeService } from '@/application/useCases/problems/judge/interactiveJudgeService';
import { TraditionalJudgeService } from '@/application/useCases/problems/judge/traditionalJudgeService';
import { Problem } from '@/domain/entities/problem';
import { JudgeServiceFactory } from '@/infrastructure/problems/judge/judgeServiceFactoryAdapter';

describe('JudgeServiceFactory', () => {
  let factory: JudgeServiceFactory;
  const traditionalMock = {} as TraditionalJudgeService;
  const interactiveMock = {} as InteractiveJudgeService;

  beforeEach(() => {
    container.registerInstance(TraditionalJudgeService, traditionalMock);
    container.registerInstance(InteractiveJudgeService, interactiveMock);
    factory = container.resolve(JudgeServiceFactory);
  });

  it('should return traditional judge when no interactor', () => {
    const problem = new Problem('test', '/src/main.cpp');
    expect(factory.create(problem)).toBe(traditionalMock);
  });

  it('should return interactive judge when interactor is set', () => {
    const problem = new Problem('test', '/src/main.cpp');
    problem.interactor = { path: '/interactor.cpp' };
    expect(factory.create(problem)).toBe(interactiveMock);
  });
});

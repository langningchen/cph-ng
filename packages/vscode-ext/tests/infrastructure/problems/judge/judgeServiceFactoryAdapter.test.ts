import { InteractiveJudgeService } from '@v/application/useCases/problems/judge/interactiveJudgeService';
import { TraditionalJudgeService } from '@v/application/useCases/problems/judge/traditionalJudgeService';
import { Problem } from '@v/domain/entities/problem';
import { JudgeServiceFactory } from '@v/infrastructure/problems/judge/judgeServiceFactoryAdapter';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';

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
    problem.interactor = { path: '/interactor.cpp', hash: null };
    expect(factory.create(problem)).toBe(interactiveMock);
  });
});

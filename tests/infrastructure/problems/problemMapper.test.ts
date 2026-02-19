import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { StressTest, StressTestState } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { VerdictName } from '@/domain/entities/verdict';
import type { TestcaseId } from '@/domain/types';
import { ProblemMapper } from '@/infrastructure/problems/problemMapper';

describe('ProblemMapper', () => {
  let mapper: ProblemMapper;

  beforeEach(() => {
    container.registerInstance(TOKENS.version, '1.0.0');
    mapper = container.resolve(ProblemMapper);
  });

  describe('toDto / toEntity round-trip', () => {
    it('should serialize and deserialize a minimal problem', () => {
      const problem = new Problem('test-problem', '/src/main.cpp');
      const dto = mapper.toDto(problem);

      expect(dto.version).toBe('1.0.0');
      expect(dto.name).toBe('test-problem');
      expect(dto.src).toEqual({ path: '/src/main.cpp' });
      expect(dto.testcaseOrder).toEqual([]);

      const restored = mapper.toEntity(dto);
      expect(restored.name).toBe('test-problem');
      expect(restored.src.path).toBe('/src/main.cpp');
    });

    it('should round-trip a problem with testcases', () => {
      const problem = new Problem('with-tc', '/src/main.cpp');
      const tc = new Testcase(
        new TestcaseIo({ data: 'input data' }),
        new TestcaseIo({ path: '/tmp/answer' }),
        true,
        false,
      );
      problem.addTestcase('tc-1' as TestcaseId, tc);

      const dto = mapper.toDto(problem);
      expect(dto.testcaseOrder).toEqual(['tc-1']);
      expect(dto.testcases['tc-1' as TestcaseId].stdin).toEqual({ data: 'input data' });
      expect(dto.testcases['tc-1' as TestcaseId].answer).toEqual({ path: '/tmp/answer' });
      expect(dto.testcases['tc-1' as TestcaseId].isExpand).toBe(true);

      const restored = mapper.toEntity(dto);
      const restoredTc = restored.getTestcase('tc-1' as TestcaseId);
      expect(restoredTc.stdin.data).toBe('input data');
      expect(restoredTc.answer.path).toBe('/tmp/answer');
      expect(restoredTc.isExpand).toBe(true);
    });

    it('should round-trip testcase with result', () => {
      const problem = new Problem('with-result', '/src/main.cpp');
      const tc = new Testcase(new TestcaseIo({ data: '' }), new TestcaseIo({ data: '' }));
      tc.updateResult({
        verdict: VerdictName.accepted,
        timeMs: 42,
        memoryMb: 16,
        stdout: new TestcaseIo({ data: 'output' }),
        stderr: new TestcaseIo({ data: '' }),
        msg: 'ok',
      });
      problem.addTestcase('tc-1' as TestcaseId, tc);

      const dto = mapper.toDto(problem);
      expect(dto.testcases['tc-1' as TestcaseId].result?.verdict).toBe(VerdictName.accepted);
      expect(dto.testcases['tc-1' as TestcaseId].result?.timeMs).toBe(42);

      const restored = mapper.toEntity(dto);
      const restoredTc = restored.getTestcase('tc-1' as TestcaseId);
      expect(restoredTc.verdict).toBe(VerdictName.accepted);
      expect(restoredTc.timeMs).toBe(42);
    });

    it('should round-trip checker and interactor', () => {
      const problem = new Problem('with-checker', '/src/main.cpp');
      problem.checker = { path: '/checker.cpp', hash: 'abc' };
      problem.interactor = { path: '/interactor.cpp', hash: 'def' };

      const dto = mapper.toDto(problem);
      expect(dto.checker).toEqual({ path: '/checker.cpp', hash: 'abc' });
      expect(dto.interactor).toEqual({ path: '/interactor.cpp', hash: 'def' });

      const restored = mapper.toEntity(dto);
      expect(restored.checker).toEqual({ path: '/checker.cpp', hash: 'abc' });
      expect(restored.interactor).toEqual({ path: '/interactor.cpp', hash: 'def' });
    });

    it('should round-trip stressTest configuration', () => {
      const problem = new Problem('with-stress', '/src/main.cpp');
      problem.stressTest = new StressTest(
        { path: '/gen.cpp' },
        { path: '/bf.cpp' },
        5,
        StressTestState.generating,
      );

      const dto = mapper.toDto(problem);
      expect(dto.stressTest.generator).toEqual({ path: '/gen.cpp' });
      expect(dto.stressTest.bruteForce).toEqual({ path: '/bf.cpp' });
      expect(dto.stressTest.cnt).toBe(5);
      expect(dto.stressTest.state).toBe(StressTestState.generating);

      const restored = mapper.toEntity(dto);
      expect(restored.stressTest.generator).toEqual({ path: '/gen.cpp' });
      expect(restored.stressTest.cnt).toBe(5);
    });

    it('should round-trip overrides', () => {
      const problem = new Problem('with-overrides', '/src/main.cpp');
      problem.overrides = { timeLimitMs: 2000, memoryLimitMb: 256 };

      const dto = mapper.toDto(problem);
      expect(dto.overrides).toEqual({ timeLimitMs: 2000, memoryLimitMb: 256 });

      const restored = mapper.toEntity(dto);
      expect(restored.overrides).toEqual({ timeLimitMs: 2000, memoryLimitMb: 256 });
    });

    it('should round-trip url', () => {
      const problem = new Problem('with-url', '/src/main.cpp');
      problem.url = 'https://codeforces.com/problem/1/A';

      const dto = mapper.toDto(problem);
      expect(dto.url).toBe('https://codeforces.com/problem/1/A');

      const restored = mapper.toEntity(dto);
      expect(restored.url).toBe('https://codeforces.com/problem/1/A');
    });

    it('should round-trip timeElapsedMs', () => {
      const problem = new Problem('with-time', '/src/main.cpp');
      problem.addTimeElapsed(12345);

      const dto = mapper.toDto(problem);
      expect(dto.timeElapsedMs).toBe(12345);

      const restored = mapper.toEntity(dto);
      expect(restored.timeElapsedMs).toBe(12345);
    });
  });
});

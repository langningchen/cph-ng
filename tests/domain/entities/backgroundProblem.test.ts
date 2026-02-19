import { describe, expect, it } from 'vitest';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';
import type { ProblemId, TestcaseId } from '@/domain/types';

describe('BackgroundProblem', () => {
  const makeBg = (startTime = 1000) => {
    const problem = new Problem('test', '/src/main.cpp');
    return new BackgroundProblem('pid-1' as ProblemId, problem, startTime);
  };

  describe('constructor', () => {
    it('should store problemId and problem', () => {
      const bg = makeBg();
      expect(bg.problemId).toBe('pid-1');
      expect(bg.problem.name).toBe('test');
    });
  });

  describe('ac (AbortController)', () => {
    it('should be null by default', () => {
      const bg = makeBg();
      expect(bg.ac).toBeNull();
    });

    it('should abort previous controller when setting new one', () => {
      const bg = makeBg();
      const ac1 = new AbortController();
      bg.ac = ac1;
      expect(bg.ac).toBe(ac1);

      const ac2 = new AbortController();
      bg.ac = ac2;
      expect(ac1.signal.aborted).toBe(true);
      expect(bg.ac).toBe(ac2);
    });
  });

  describe('abort', () => {
    it('should abort current controller and set to null', () => {
      const bg = makeBg();
      const ac = new AbortController();
      bg.ac = ac;

      bg.abort();

      expect(ac.signal.aborted).toBe(true);
      expect(bg.ac).toBeNull();
    });

    it('should abort with specific target (testcaseId)', () => {
      const bg = makeBg();
      const ac = new AbortController();
      bg.ac = ac;

      bg.abort('tc-1' as TestcaseId);

      expect(ac.signal.aborted).toBe(true);
      expect(ac.signal.reason).toBe('tc-1');
    });

    it('should be no-op if no controller', () => {
      const bg = makeBg();
      expect(() => bg.abort()).not.toThrow();
    });
  });

  describe('addTimeElapsed', () => {
    it('should add elapsed time to problem and update startTime', () => {
      const bg = makeBg(1000);
      bg.addTimeElapsed(1500);
      expect(bg.problem.timeElapsedMs).toBe(500);

      bg.addTimeElapsed(2000);
      expect(bg.problem.timeElapsedMs).toBe(1000);
    });
  });
});

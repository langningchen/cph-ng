import { describe, expect, it, vi } from 'vitest';
import { Problem } from '@/domain/entities/problem';
import { StressTest, StressTestState } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { VerdictName } from '@/domain/entities/verdict';
import type { TestcaseId } from '@/domain/types';

describe('Problem', () => {
  const createTestcase = (input = '', answer = '') =>
    new Testcase(new TestcaseIo({ data: input }), new TestcaseIo({ data: answer }));

  describe('constructor', () => {
    it('should create from string src path', () => {
      const p = new Problem('test', '/src/main.cpp');
      expect(p.name).toBe('test');
      expect(p.src).toEqual({ path: '/src/main.cpp' });
      expect(p.revision).toBe(0);
    });

    it('should create from IFileWithHash', () => {
      const p = new Problem('test', { path: '/src/main.cpp', hash: 'abc' });
      expect(p.src).toEqual({ path: '/src/main.cpp', hash: 'abc' });
    });
  });

  describe('revision tracking', () => {
    it('should increment revision on addTestcase', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      expect(p.revision).toBe(1);
    });

    it('should increment revision on deleteTestcase', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      p.deleteTestcase('tc-1' as TestcaseId);
      expect(p.revision).toBe(2);
    });

    it('should increment revision on checker set', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.checker = { path: '/checker.cpp' };
      expect(p.revision).toBe(1);
    });

    it('should increment revision on interactor set', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.interactor = { path: '/interactor.cpp' };
      expect(p.revision).toBe(1);
    });
  });

  describe('testcase management', () => {
    it('should add and retrieve testcases', () => {
      const p = new Problem('test', '/src/main.cpp');
      const tc = createTestcase('input', 'output');
      p.addTestcase('tc-1' as TestcaseId, tc);

      expect(p.testcases.size).toBe(1);
      expect(p.testcaseOrder).toEqual(['tc-1']);
      expect(p.getTestcase('tc-1' as TestcaseId)).toBe(tc);
    });

    it('should throw on getting non-existent testcase', () => {
      const p = new Problem('test', '/src/main.cpp');
      expect(() => p.getTestcase('missing' as TestcaseId)).toThrow('Test case not found');
    });

    it('should delete testcase from order', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      p.addTestcase('tc-2' as TestcaseId, createTestcase());
      p.deleteTestcase('tc-1' as TestcaseId);

      expect(p.testcaseOrder).toEqual(['tc-2']);
    });

    it('should move testcase in order', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      p.addTestcase('tc-2' as TestcaseId, createTestcase());
      p.addTestcase('tc-3' as TestcaseId, createTestcase());

      p.moveTestcase(0, 2);

      expect(p.testcaseOrder).toEqual(['tc-2', 'tc-3', 'tc-1']);
    });

    it('should clear all testcases', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      p.addTestcase('tc-2' as TestcaseId, createTestcase());

      p.clearTestcases();

      expect(p.testcaseOrder).toEqual([]);
      expect(p.testcases.size).toBe(0);
    });

    it('should get enabled testcase IDs only', () => {
      const p = new Problem('test', '/src/main.cpp');
      const tc1 = createTestcase();
      const tc2 = createTestcase();
      tc2.isDisabled = true;
      const tc3 = createTestcase();

      p.addTestcase('tc-1' as TestcaseId, tc1);
      p.addTestcase('tc-2' as TestcaseId, tc2);
      p.addTestcase('tc-3' as TestcaseId, tc3);

      expect(p.getEnabledTestcaseIds()).toEqual(['tc-1', 'tc-3']);
    });
  });

  describe('events', () => {
    it('should emit addTestcase event', () => {
      const p = new Problem('test', '/src/main.cpp');
      const handler = vi.fn();
      p.signals.on('addTestcase', handler);

      const tc = createTestcase();
      p.addTestcase('tc-1' as TestcaseId, tc);

      expect(handler).toHaveBeenCalledWith('tc-1', tc, 1);
    });

    it('should emit deleteTestcase event', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, createTestcase());
      const handler = vi.fn();
      p.signals.on('deleteTestcase', handler);

      p.deleteTestcase('tc-1' as TestcaseId);

      expect(handler).toHaveBeenCalledWith('tc-1', 2);
    });

    it('should emit patchMeta on checker change', () => {
      const p = new Problem('test', '/src/main.cpp');
      const handler = vi.fn();
      p.signals.on('patchMeta', handler);

      p.checker = { path: '/checker.cpp' };

      expect(handler).toHaveBeenCalledWith({
        checker: { path: '/checker.cpp' },
        revision: 1,
      });
    });

    it('should propagate testcase patch events', () => {
      const p = new Problem('test', '/src/main.cpp');
      const handler = vi.fn();
      p.signals.on('patchTestcase', handler);

      const tc = createTestcase();
      p.addTestcase('tc-1' as TestcaseId, tc);

      tc.isExpand = true;

      expect(handler).toHaveBeenCalledWith('tc-1', { isExpand: true }, expect.any(Number));
    });

    it('should propagate stressTest change events', () => {
      const p = new Problem('test', '/src/main.cpp');
      const handler = vi.fn();
      p.signals.on('patchStressTest', handler);

      p.stressTest.state = StressTestState.compiling;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ state: StressTestState.compiling, revision: expect.any(Number) }),
      );
    });
  });

  describe('stressTest setter', () => {
    it('should swap stressTest and re-bind event listener', () => {
      const p = new Problem('test', '/src/main.cpp');
      const handler = vi.fn();
      p.signals.on('patchStressTest', handler);

      const oldSt = p.stressTest;
      const newSt = new StressTest({ path: '/gen.cpp' }, null, 0, StressTestState.inactive);
      p.stressTest = newSt;

      // Old should no longer trigger
      oldSt.state = StressTestState.compiling;
      expect(handler).not.toHaveBeenCalled();

      // New should trigger
      newSt.state = StressTestState.generating;
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('purgeUnusedTestcases', () => {
    it('should remove testcases not in order', () => {
      const p = new Problem('test', '/src/main.cpp');
      const tc1 = new Testcase(new TestcaseIo({ path: '/tmp/orphan' }));
      p.addTestcase('tc-1' as TestcaseId, tc1);
      p.addTestcase('tc-2' as TestcaseId, createTestcase());

      // Remove tc-1 from order but not from map
      p.deleteTestcase('tc-1' as TestcaseId);
      const disposables = p.purgeUnusedTestcases();

      expect(p.testcases.has('tc-1' as TestcaseId)).toBe(false);
      expect(disposables).toContain('/tmp/orphan');
    });
  });

  describe('isRelated', () => {
    it('should match src path case-insensitively', () => {
      const p = new Problem('test', '/src/Main.cpp');
      expect(p.isRelated('/src/main.cpp')).toBe(true);
    });

    it('should match checker path', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.checker = { path: '/checker.cpp' };
      expect(p.isRelated('/Checker.cpp')).toBe(true);
    });

    it('should match interactor path', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.interactor = { path: '/interactor.cpp' };
      expect(p.isRelated('/Interactor.cpp')).toBe(true);
    });

    it('should match stressTest paths', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.stressTest.generator = { path: '/gen.cpp' };
      expect(p.isRelated('/Gen.cpp')).toBe(true);
    });

    it('should match testcase paths', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTestcase('tc-1' as TestcaseId, new Testcase(new TestcaseIo({ path: '/tmp/input' })));
      expect(p.isRelated('/tmp/input')).toBe(true);
    });

    it('should return false for unrelated path', () => {
      const p = new Problem('test', '/src/main.cpp');
      expect(p.isRelated('/other.txt')).toBe(false);
    });
  });

  describe('clearResult', () => {
    it('should clear results from all testcases in order', () => {
      const p = new Problem('test', '/src/main.cpp');
      const tc = createTestcase();
      tc.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
      });
      p.addTestcase('tc-1' as TestcaseId, tc);

      const disposables = p.clearResult();
      expect(disposables).toContain('/tmp/stdout');
    });
  });

  describe('addTimeElapsed', () => {
    it('should accumulate time', () => {
      const p = new Problem('test', '/src/main.cpp');
      p.addTimeElapsed(100);
      p.addTimeElapsed(200);
      expect(p.timeElapsedMs).toBe(300);
    });
  });

  describe('updateResult', () => {
    it('should update result for all enabled testcases', () => {
      const p = new Problem('test', '/src/main.cpp');
      const tc1 = createTestcase();
      const tc2 = createTestcase();
      tc2.isDisabled = true;
      const tc3 = createTestcase();

      p.addTestcase('tc-1' as TestcaseId, tc1);
      p.addTestcase('tc-2' as TestcaseId, tc2);
      p.addTestcase('tc-3' as TestcaseId, tc3);

      p.updateResult({ verdict: VerdictName.waiting });

      expect(tc1.verdict).toBe(VerdictName.waiting);
      expect(tc2.verdict).toBeUndefined();
      expect(tc3.verdict).toBe(VerdictName.waiting);
    });
  });
});

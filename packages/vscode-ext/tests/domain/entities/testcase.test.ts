import { VerdictName } from '@cph-ng/core';
import { describe, expect, it, vi } from 'vitest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

describe('Testcase', () => {
  describe('constructor defaults', () => {
    it('should initialize with default values', () => {
      const testcase = new Testcase();
      expect(testcase.stdin.data).toBe('');
      expect(testcase.answer.data).toBe('');
      expect(testcase.isExpand).toBe(false);
      expect(testcase.isDisabled).toBe(false);
      expect(testcase.result).toBeNull();
    });
  });

  describe('stdin setter', () => {
    it('should emit patchTestcase when stdin changes', () => {
      const testcase = new Testcase();
      const handler = vi.fn();
      testcase.signals.on('patchTestcase', handler);

      const newStdin = new TestcaseIo({ data: 'new input' });
      testcase.stdin = newStdin;

      expect(testcase.stdin).toBe(newStdin);
      expect(handler).toHaveBeenCalledWith({ stdin: newStdin });
    });
  });

  describe('answer setter', () => {
    it('should emit patchTestcase when answer changes', () => {
      const testcase = new Testcase();
      const handler = vi.fn();
      testcase.signals.on('patchTestcase', handler);

      const newAnswer = new TestcaseIo({ data: 'expected' });
      testcase.answer = newAnswer;

      expect(testcase.answer).toBe(newAnswer);
      expect(handler).toHaveBeenCalledWith({ answer: newAnswer });
    });
  });

  describe('isExpand setter', () => {
    it('should emit patchTestcase when isExpand changes', () => {
      const testcase = new Testcase();
      const handler = vi.fn();
      testcase.signals.on('patchTestcase', handler);

      testcase.isExpand = true;

      expect(testcase.isExpand).toBe(true);
      expect(handler).toHaveBeenCalledWith({ isExpand: true });
    });
  });

  describe('isDisabled setter', () => {
    it('should emit patchTestcase when isDisabled changes', () => {
      const testcase = new Testcase();
      const handler = vi.fn();
      testcase.signals.on('patchTestcase', handler);

      testcase.isDisabled = true;

      expect(testcase.isDisabled).toBe(true);
      expect(handler).toHaveBeenCalledWith({ isDisabled: true });
    });
  });

  describe('updateResult', () => {
    it('should set initial result and emit event', () => {
      const testcase = new Testcase();
      const handler = vi.fn();
      testcase.signals.on('patchTestcaseResult', handler);

      const stdout = new TestcaseIo({ data: 'output' });
      const stderr = new TestcaseIo({ data: 'err' });
      testcase.updateResult({
        verdict: VerdictName.accepted,
        timeMs: 100,
        memoryMb: 64,
        stdout,
        stderr,
      });

      expect(testcase.result?.verdict).toBe(VerdictName.accepted);
      expect(testcase.result?.timeMs).toBe(100);
      expect(testcase.result?.memoryMb).toBe(64);
      expect(testcase.result?.stdout).toBe(stdout);
      expect(testcase.result?.stderr).toBe(stderr);
      expect(handler).toHaveBeenCalled();
    });

    it('should accumulate messages', () => {
      const testcase = new Testcase();
      testcase.updateResult({ verdict: VerdictName.wrongAnswer, msg: 'line1' });
      testcase.updateResult({ verdict: VerdictName.wrongAnswer, msg: 'line2' });

      expect(testcase.result?.msg).toBe('line1\n\nline2\n');
    });

    it('should preserve existing fields when not provided in update', () => {
      const testcase = new Testcase();
      const stdout = new TestcaseIo({ data: 'out' });
      testcase.updateResult({ verdict: VerdictName.accepted, timeMs: 100, stdout });
      testcase.updateResult({ verdict: VerdictName.wrongAnswer });

      expect(testcase.result?.timeMs).toBe(100);
      expect(testcase.result?.stdout).toBe(stdout);
    });

    it('should set isExpand when provided', () => {
      const testcase = new Testcase();
      const patchHandler = vi.fn();
      testcase.signals.on('patchTestcase', patchHandler);
      testcase.isExpand = true;

      expect(patchHandler).toHaveBeenCalledWith({ isExpand: true });
    });
  });

  describe('clearResult', () => {
    it('should clear result and return disposables from stdout/stderr paths', () => {
      const testcase = new Testcase();
      testcase.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
        stderr: new TestcaseIo({ path: '/tmp/stderr' }),
      });

      const disposables = testcase.clearResult();

      expect(testcase.result).toBeNull();
      expect(disposables).toContain('/tmp/stdout');
      expect(disposables).toContain('/tmp/stderr');
    });

    it('should return empty array when no result', () => {
      const testcase = new Testcase();
      expect(testcase.clearResult()).toEqual([]);
    });
  });

  describe('getDisposables', () => {
    it('should collect all path-based disposables', () => {
      const testcase = new Testcase(
        new TestcaseIo({ path: '/tmp/stdin' }),
        new TestcaseIo({ path: '/tmp/answer' }),
      );
      testcase.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
        stderr: new TestcaseIo({ path: '/tmp/stderr' }),
      });

      const disposables = testcase.getDisposables();
      expect(disposables).toContain('/tmp/stdin');
      expect(disposables).toContain('/tmp/answer');
      expect(disposables).toContain('/tmp/stdout');
      expect(disposables).toContain('/tmp/stderr');
    });

    it('should not include data-based IOs', () => {
      const testcase = new Testcase(
        new TestcaseIo({ data: 'input' }),
        new TestcaseIo({ data: 'answer' }),
      );
      expect(testcase.getDisposables()).toEqual([]);
    });
  });

  describe('isRelated', () => {
    it('should match stdin path case-sensitively', () => {
      const testcase = new Testcase(new TestcaseIo({ path: '/tmp/input.txt' }));
      expect(testcase.isRelated('/tmp/input.txt')).toBe(true);
      expect(testcase.isRelated('/tmp/Input.txt')).toBe(false);
    });

    it('should match answer path', () => {
      const testcase = new Testcase(
        new TestcaseIo({ data: '' }),
        new TestcaseIo({ path: '/tmp/answer.txt' }),
      );
      expect(testcase.isRelated('/tmp/answer.txt')).toBe(true);
    });

    it('should match stdout path from result', () => {
      const testcase = new Testcase();
      testcase.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
      });
      expect(testcase.isRelated('/tmp/stdout')).toBe(true);
    });

    it('should return false for unrelated path', () => {
      const testcase = new Testcase(new TestcaseIo({ data: 'input' }));
      expect(testcase.isRelated('/tmp/other.txt')).toBe(false);
    });
  });
});

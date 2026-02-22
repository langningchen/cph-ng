import { describe, expect, it, vi } from 'vitest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { VerdictName } from '@/domain/entities/verdict';

describe('Testcase', () => {
  describe('constructor defaults', () => {
    it('should initialize with default values', () => {
      const tc = new Testcase();
      expect(tc.stdin.data).toBe('');
      expect(tc.answer.data).toBe('');
      expect(tc.isExpand).toBe(false);
      expect(tc.isDisabled).toBe(false);
      expect(tc.verdict).toBeUndefined();
    });
  });

  describe('stdin setter', () => {
    it('should emit patchTestcase when stdin changes', () => {
      const tc = new Testcase();
      const handler = vi.fn();
      tc.signals.on('patchTestcase', handler);

      const newStdin = new TestcaseIo({ data: 'new input' });
      tc.stdin = newStdin;

      expect(tc.stdin).toBe(newStdin);
      expect(handler).toHaveBeenCalledWith({ stdin: newStdin });
    });
  });

  describe('answer setter', () => {
    it('should emit patchTestcase when answer changes', () => {
      const tc = new Testcase();
      const handler = vi.fn();
      tc.signals.on('patchTestcase', handler);

      const newAnswer = new TestcaseIo({ data: 'expected' });
      tc.answer = newAnswer;

      expect(tc.answer).toBe(newAnswer);
      expect(handler).toHaveBeenCalledWith({ answer: newAnswer });
    });
  });

  describe('isExpand setter', () => {
    it('should emit patchTestcase when isExpand changes', () => {
      const tc = new Testcase();
      const handler = vi.fn();
      tc.signals.on('patchTestcase', handler);

      tc.isExpand = true;

      expect(tc.isExpand).toBe(true);
      expect(handler).toHaveBeenCalledWith({ isExpand: true });
    });
  });

  describe('isDisabled setter', () => {
    it('should emit patchTestcase when isDisabled changes', () => {
      const tc = new Testcase();
      const handler = vi.fn();
      tc.signals.on('patchTestcase', handler);

      tc.isDisabled = true;

      expect(tc.isDisabled).toBe(true);
      expect(handler).toHaveBeenCalledWith({ isDisabled: true });
    });
  });

  describe('updateResult', () => {
    it('should set initial result and emit event', () => {
      const tc = new Testcase();
      const handler = vi.fn();
      tc.signals.on('patchTestcaseResult', handler);

      const stdout = new TestcaseIo({ data: 'output' });
      const stderr = new TestcaseIo({ data: 'err' });
      tc.updateResult({
        verdict: VerdictName.accepted,
        timeMs: 100,
        memoryMb: 64,
        stdout,
        stderr,
      });

      expect(tc.verdict).toBe(VerdictName.accepted);
      expect(tc.timeMs).toBe(100);
      expect(tc.memoryMb).toBe(64);
      expect(tc.stdout).toBe(stdout);
      expect(tc.stderr).toBe(stderr);
      expect(handler).toHaveBeenCalled();
    });

    it('should accumulate messages', () => {
      const tc = new Testcase();
      tc.updateResult({ verdict: VerdictName.wrongAnswer, msg: 'line1' });
      tc.updateResult({ verdict: VerdictName.wrongAnswer, msg: 'line2' });

      expect(tc.msg).toBe('line1\n\nline2\n');
    });

    it('should preserve existing fields when not provided in update', () => {
      const tc = new Testcase();
      const stdout = new TestcaseIo({ data: 'out' });
      tc.updateResult({ verdict: VerdictName.accepted, timeMs: 100, stdout });
      tc.updateResult({ verdict: VerdictName.wrongAnswer });

      expect(tc.timeMs).toBe(100);
      expect(tc.stdout).toBe(stdout);
    });

    it('should set isExpand when provided', () => {
      const tc = new Testcase();
      const patchHandler = vi.fn();
      tc.signals.on('patchTestcase', patchHandler);

      tc.updateResult({ verdict: VerdictName.wrongAnswer, isExpand: true });

      expect(tc.isExpand).toBe(true);
      expect(patchHandler).toHaveBeenCalledWith({ isExpand: true });
    });
  });

  describe('clearResult', () => {
    it('should clear result and return disposables from stdout/stderr paths', () => {
      const tc = new Testcase();
      tc.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
        stderr: new TestcaseIo({ path: '/tmp/stderr' }),
      });

      const disposables = tc.clearResult();

      expect(tc.verdict).toBeUndefined();
      expect(disposables).toContain('/tmp/stdout');
      expect(disposables).toContain('/tmp/stderr');
    });

    it('should return empty array when no result', () => {
      const tc = new Testcase();
      expect(tc.clearResult()).toEqual([]);
    });
  });

  describe('getDisposables', () => {
    it('should collect all path-based disposables', () => {
      const tc = new Testcase(
        new TestcaseIo({ path: '/tmp/stdin' }),
        new TestcaseIo({ path: '/tmp/answer' }),
      );
      tc.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
        stderr: new TestcaseIo({ path: '/tmp/stderr' }),
      });

      const disposables = tc.getDisposables();
      expect(disposables).toContain('/tmp/stdin');
      expect(disposables).toContain('/tmp/answer');
      expect(disposables).toContain('/tmp/stdout');
      expect(disposables).toContain('/tmp/stderr');
    });

    it('should not include data-based IOs', () => {
      const tc = new Testcase(
        new TestcaseIo({ data: 'input' }),
        new TestcaseIo({ data: 'answer' }),
      );
      expect(tc.getDisposables()).toEqual([]);
    });
  });

  describe('isRelated', () => {
    it('should match stdin path case-insensitively', () => {
      const tc = new Testcase(new TestcaseIo({ path: '/tmp/Input.txt' }));
      expect(tc.isRelated('/tmp/input.txt')).toBe(true);
    });

    it('should match answer path', () => {
      const tc = new Testcase(
        new TestcaseIo({ data: '' }),
        new TestcaseIo({ path: '/tmp/answer.txt' }),
      );
      expect(tc.isRelated('/tmp/Answer.txt')).toBe(true);
    });

    it('should match stdout path from result', () => {
      const tc = new Testcase();
      tc.updateResult({
        verdict: VerdictName.accepted,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
      });
      expect(tc.isRelated('/tmp/stdout')).toBe(true);
    });

    it('should return false for unrelated path', () => {
      const tc = new Testcase(new TestcaseIo({ data: 'input' }));
      expect(tc.isRelated('/tmp/other.txt')).toBe(false);
    });
  });
});

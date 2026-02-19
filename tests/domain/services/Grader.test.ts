import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { VerdictName } from '@/domain/entities/verdict';
import { Grader } from '@/domain/services/Grader';

describe('Grader', () => {
  let grader: Grader;

  beforeEach(() => {
    grader = container.resolve(Grader);
  });

  describe('compareStrings', () => {
    const defaultConfig = { ignoreError: true, regardPEAsAC: false };

    it('should return AC when outputs match exactly', () => {
      expect(grader.compareStrings('hello', 'hello', '', defaultConfig)).toBe(VerdictName.accepted);
    });

    it('should return AC when trailing whitespace differs', () => {
      expect(grader.compareStrings('hello  \n', 'hello\n', '', defaultConfig)).toBe(
        VerdictName.accepted,
      );
    });

    it('should return WA when content differs', () => {
      expect(grader.compareStrings('hello', 'world', '', defaultConfig)).toBe(
        VerdictName.wrongAnswer,
      );
    });

    it('should return PE when whitespace-compressed match but exact does not', () => {
      expect(grader.compareStrings('hello world', 'helloworld', '', defaultConfig)).toBe(
        VerdictName.presentationError,
      );
    });

    it('should return AC for PE when regardPEAsAC is true', () => {
      expect(
        grader.compareStrings('hello world', 'helloworld', '', {
          ...defaultConfig,
          regardPEAsAC: true,
        }),
      ).toBe(VerdictName.accepted);
    });

    it('should return RE when stderr is non-empty and ignoreError is false', () => {
      expect(
        grader.compareStrings('hello', 'hello', 'some error', {
          ignoreError: false,
          regardPEAsAC: false,
        }),
      ).toBe(VerdictName.runtimeError);
    });

    it('should ignore stderr when ignoreError is true', () => {
      expect(grader.compareStrings('hello', 'hello', 'some error', defaultConfig)).toBe(
        VerdictName.accepted,
      );
    });

    it('should return OLE when output exceeds oleSize multiplier', () => {
      const expected = 'ab';
      const actual = 'a'.repeat(100);
      expect(grader.compareStrings(actual, expected, '', { ...defaultConfig, oleSize: 8 })).toBe(
        VerdictName.outputLimitExceed,
      );
    });

    it('should not return OLE when output is within oleSize limit', () => {
      const expected = 'ab';
      const actual = 'ab';
      expect(grader.compareStrings(actual, expected, '', { ...defaultConfig, oleSize: 8 })).toBe(
        VerdictName.accepted,
      );
    });

    it('should handle multiline output with trailing spaces', () => {
      const actual = 'line1  \nline2  ';
      const expected = 'line1\nline2';
      expect(grader.compareStrings(actual, expected, '', defaultConfig)).toBe(VerdictName.accepted);
    });

    it('should handle empty strings', () => {
      expect(grader.compareStrings('', '', '', defaultConfig)).toBe(VerdictName.accepted);
    });

    it('should treat only-whitespace stderr as no error', () => {
      expect(
        grader.compareStrings('hello', 'hello', '  \n  ', {
          ignoreError: false,
          regardPEAsAC: false,
        }),
      ).toBe(VerdictName.accepted);
    });
  });

  describe('mapTestlibExitCode', () => {
    it.each([
      [0, VerdictName.accepted],
      [1, VerdictName.wrongAnswer],
      [2, VerdictName.presentationError],
      [3, VerdictName.systemError],
      [4, VerdictName.wrongAnswer],
      [7, VerdictName.partiallyCorrect],
    ])('should map exit code %d to %s', (code, expected) => {
      expect(grader.mapTestlibExitCode(code)).toBe(expected);
    });

    it('should map unknown exit codes to systemError', () => {
      expect(grader.mapTestlibExitCode(99)).toBe(VerdictName.systemError);
      expect(grader.mapTestlibExitCode(-1)).toBe(VerdictName.systemError);
    });
  });
});

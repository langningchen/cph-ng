import { describe, expect, it } from 'vitest';
import { parseCommandArgs } from '@/infrastructure/langs/parseCommandArgs';

describe('parseCommandArgs', () => {
  it('returns no arguments for an empty string', () => {
    expect(parseCommandArgs('')).toEqual([]);
    expect(parseCommandArgs('   ')).toEqual([]);
  });

  it('keeps quoted Windows paths as one argument', () => {
    expect(parseCommandArgs('-I "D:\\ACM Data\\lib"')).toEqual(['-I', 'D:\\ACM Data\\lib']);
  });

  it('supports double quotes, single quotes, and empty quoted arguments', () => {
    expect(parseCommandArgs(`--define "A B" --message 'hello world' --empty ""`)).toEqual([
      '--define',
      'A B',
      '--message',
      'hello world',
      '--empty',
      '',
    ]);
  });

  it('keeps quotes embedded in an argument', () => {
    expect(parseCommandArgs('-DNAME="hello world"')).toEqual(['-DNAME=hello world']);
  });
});

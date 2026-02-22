import { pathMock } from '@t/infrastructure/node/pathMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKENS } from '@/composition/tokens';
import { TestcaseMatcher } from '@/domain/services/TestcaseMatcher';

describe('TestcaseMatcher', () => {
  let matcher: TestcaseMatcher;

  beforeEach(() => {
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.path, pathMock);
    matcher = container.resolve(TestcaseMatcher);
  });

  it('should match input and output files with same basename', () => {
    const files = ['/tests/1.in', '/tests/1.ans'];
    const pairs = matcher.matchPairs(files);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].input).toBe('/tests/1.in');
    expect(pairs[0].output).toBe('/tests/1.ans');
  });

  it('should prefer .ans over .out as output extension', () => {
    const files = ['/tests/1.in', '/tests/1.ans', '/tests/1.out'];
    const pairs = matcher.matchPairs(files);

    expect(pairs).toHaveLength(2);
    const inputPair = pairs.find((p) => p.input === '/tests/1.in');
    expect(inputPair?.output).toBe('/tests/1.ans');
  });

  it('should create orphaned output for unmatched output files', () => {
    const files = ['/tests/1.in', '/tests/2.ans'];
    const pairs = matcher.matchPairs(files);

    expect(pairs).toHaveLength(2);
    const orphaned = pairs.find((p) => !p.input);
    expect(orphaned?.output).toBe('/tests/2.ans');
  });

  it('should create input-only pair when no matching output', () => {
    const files = ['/tests/1.in'];
    const pairs = matcher.matchPairs(files);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].input).toBe('/tests/1.in');
    expect(pairs[0].output).toBeUndefined();
  });

  it('should return empty array for empty input', () => {
    expect(matcher.matchPairs([])).toEqual([]);
  });

  it('should handle multiple pairs', () => {
    const files = ['/tests/1.in', '/tests/1.ans', '/tests/2.in', '/tests/2.ans'];
    const pairs = matcher.matchPairs(files);

    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.input && p.output)).toBe(true);
  });

  it('should sort input pairs before orphaned outputs', () => {
    const files = ['/tests/orphan.ans', '/tests/1.in'];
    const pairs = matcher.matchPairs(files);

    expect(pairs[0].input).toBe('/tests/1.in');
    expect(pairs[1].input).toBeUndefined();
    expect(pairs[1].output).toBe('/tests/orphan.ans');
  });

  it('should not treat non-input extensions as input', () => {
    const files = ['/tests/1.txt', '/tests/1.ans'];
    const pairs = matcher.matchPairs(files);

    // 1.txt is not an input file, 1.ans is orphaned output
    expect(pairs).toHaveLength(1);
    expect(pairs[0].input).toBeUndefined();
    expect(pairs[0].output).toBe('/tests/1.ans');
  });
});

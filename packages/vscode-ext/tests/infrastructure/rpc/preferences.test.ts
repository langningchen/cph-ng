import type { TestcaseId } from '@cph-ng/core';
import { expect, it } from 'vitest';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { ProblemPreferences } from '@/infrastructure/rpc/preferences';

it('restores editor state without restoring compiler overrides after reopening a moved problem', async () => {
  const data = new Map<string, unknown>();
  const store = {
    get<T>(key: string): T | undefined {
      return data.get(key) as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      data.set(key, value);
    },
  };
  const preferences = new ProblemPreferences(store);
  const testcaseId = '00000000-0000-0000-0000-000000000002' as TestcaseId;
  const original = new Problem('A', '/before/main.cpp');
  original.overrides.compilerArgs = '-O0 -DLOCAL';
  const testcase = new Testcase();
  testcase.isExpand = true;
  testcase.isDisabled = true;
  original.addTestcase(testcaseId, testcase);
  await preferences.save('stable-problem-id', original);
  const reopened = new Problem('A', '/after/main.cpp');
  reopened.addTestcase(testcaseId, new Testcase());
  preferences.restore('stable-problem-id', reopened);
  expect(reopened.overrides.compilerArgs).toBeNull();
  expect(reopened.getTestcase(testcaseId).isExpand).toBe(true);
  expect(reopened.getEnabledTestcaseIds()).toEqual([]);
  await preferences.remove('stable-problem-id');
  const deleted = new Problem('A', '/after/main.cpp');
  deleted.addTestcase(testcaseId, new Testcase());
  preferences.restore('stable-problem-id', deleted);
  expect(deleted.getTestcase(testcaseId).isDisabled).toBe(false);
  expect(deleted.overrides.compilerArgs).toBeNull();
});

it('preserves legacy overrides for explicit migration while normal saves never apply them', async () => {
  const data = new Map<string, unknown>();
  const overrides = new Problem('A', '/main.cpp').overrides;
  overrides.compilerArgs = '-O0 -DOLD';
  data.set('judge.preferences.old-id', { version: 1, overrides, testcases: {} });
  const preferences = new ProblemPreferences({
    get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async update(key: string, value: unknown) {
      data.set(key, value);
    },
  });
  const problem = new Problem('A', '/main.cpp');
  preferences.restore('old-id', problem);
  expect(problem.overrides.compilerArgs).toBeNull();
  await preferences.save('old-id', problem);
  expect(preferences.legacyOverrides('old-id')?.compilerArgs).toBe('-O0 -DOLD');
  await preferences.finishMigration('old-id');
  expect(preferences.legacyOverrides('old-id')).toBeUndefined();
});

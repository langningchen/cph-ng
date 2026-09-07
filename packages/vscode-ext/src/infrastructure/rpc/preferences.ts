import type { TestcaseId } from '@cph-ng/core';
import type { Problem } from '@/domain/entities/problem';

interface PreferenceStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}
interface SavedPreferences {
  version: 1 | 2;
  timeElapsedMs?: number;
  overrides?: Problem['overrides'];
  pendingLegacyOverrides?: Problem['overrides'];
  testcases: Record<string, { isExpand: boolean; isDisabled: boolean }>;
}

/** Editor preferences remain local; judge inputs and history belong to the kernel. */
export class ProblemPreferences {
  public constructor(private readonly store: PreferenceStore) {}

  public restore(id: string, problem: Problem): void {
    const saved = this.store.get<SavedPreferences>(`judge.preferences.${id}`);
    if (!saved || ![1, 2].includes(saved.version)) return;
    if (
      typeof saved.timeElapsedMs === 'number' &&
      Number.isFinite(saved.timeElapsedMs) &&
      saved.timeElapsedMs >= 0
    )
      problem.addTimeElapsed(saved.timeElapsedMs - problem.timeElapsedMs);
    for (const [id, state] of Object.entries(saved.testcases)) {
      const testcase = problem.testcases.get(id as TestcaseId);
      if (!testcase) continue;
      testcase.isExpand = state.isExpand;
      testcase.isDisabled = state.isDisabled;
    }
  }

  public async save(id: string, problem: Problem): Promise<void> {
    const previous = this.store.get<SavedPreferences>(`judge.preferences.${id}`);
    const saved: SavedPreferences = {
      version: 2,
      timeElapsedMs: problem.timeElapsedMs,
      // Preserve old data for the explicit migration command without applying it to runs.
      pendingLegacyOverrides: previous?.overrides ?? previous?.pendingLegacyOverrides,
      testcases: Object.fromEntries(
        [...problem.testcases].map(([id, testcase]) => [
          id,
          { isExpand: testcase.isExpand, isDisabled: testcase.isDisabled },
        ]),
      ),
    };
    await this.store.update(`judge.preferences.${id}`, saved);
  }

  public legacyOverrides(id: string): Problem['overrides'] | undefined {
    const saved = this.store.get<SavedPreferences>(`judge.preferences.${id}`);
    return saved?.overrides ?? saved?.pendingLegacyOverrides;
  }

  public async stageLegacyOverrides(id: string, overrides: Problem['overrides']): Promise<void> {
    if (this.legacyOverrides(id)) return;
    const saved = this.store.get<SavedPreferences>(`judge.preferences.${id}`);
    await this.store.update(`judge.preferences.${id}`, {
      version: 2,
      testcases: saved?.testcases ?? {},
      timeElapsedMs: saved?.timeElapsedMs,
      pendingLegacyOverrides: { ...overrides },
    });
  }

  public async finishMigration(id: string): Promise<void> {
    const saved = this.store.get<SavedPreferences>(`judge.preferences.${id}`);
    if (!saved) return;
    await this.store.update(`judge.preferences.${id}`, {
      version: 2,
      testcases: saved.testcases,
      timeElapsedMs: saved.timeElapsedMs,
    });
  }

  public async remove(id: string): Promise<void> {
    await this.store.update(`judge.preferences.${id}`, undefined);
  }
}

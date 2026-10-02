import { describe, expect, it, vi } from 'vitest';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import { StartStressTest } from '@/application/useCases/webview/problem/stressTest/StartStressTest';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';
import type { RpcJudgeService } from '@/infrastructure/rpc/judgeService';

vi.mock('@/infrastructure/rpc/judgeService', () => ({
  // biome-ignore lint/style/useNamingConvention: The mock must match the exported class name.
  RpcJudgeService: class {},
}));
describe('StartStressTest RPC migration', () => {
  it('delegates stress execution to the kernel and persists after completion', async () => {
    const problemId = '00000000-0000-0000-0000-000000000000';
    const background = new BackgroundProblem(problemId, new Problem('test', '/source.cpp'), 0);
    const repo = {
      get: vi.fn().mockResolvedValue(background),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const judge = { run: vi.fn().mockResolvedValue(undefined) };
    const service = new StartStressTest(
      repo as unknown as IProblemRepository,
      judge as unknown as RpcJudgeService,
    );
    await service.exec({ problemId, type: 'startStressTest', forceCompile: null });
    expect(judge.run).toHaveBeenCalledWith(background, undefined, true, null);
    expect(repo.save).toHaveBeenCalledWith(problemId);
  });
});

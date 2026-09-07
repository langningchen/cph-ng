// biome-ignore-all lint/style/useNamingConvention: RPC fields and mocked class exports match the wire/module names.
import type { TestcaseId } from '@cph-ng/core';
import { StressTestState, VerdictName } from '@cph-ng/core';
import { describe, expect, it, vi } from 'vitest';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { StartStressTest } from '@/application/useCases/webview/problem/stressTest/StartStressTest';
import { RunAllTestcases } from '@/application/useCases/webview/problem/testcase/run/RunAllTestcases';
import { RunSingleTestcase } from '@/application/useCases/webview/problem/testcase/run/RunSingleTestcase';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import {
  type KernelRpcClient,
  RpcRemoteError,
  type TaskEvent,
  type TaskInfo,
} from '@/infrastructure/rpc/client';
import { RpcJudgeService } from '@/infrastructure/rpc/judgeService';
import type { KernelService } from '@/infrastructure/rpc/kernelService';
import type { RpcProblemService } from '@/infrastructure/rpc/problemService';
import { rpcErrorCode, rpcMethod } from '@/infrastructure/rpc/protocol';

vi.mock('@/infrastructure/rpc/kernelService', () => ({ KernelService: class {} }));
vi.mock('@/infrastructure/rpc/problemService', () => ({ RpcProblemService: class {} }));

const ids = [1, 2, 3].map((id) => `00000000-0000-0000-0000-00000000000${id}` as TestcaseId);
const result = (id: TestcaseId, verdict = 'accepted') => ({
  testcase_id: id,
  verdict,
  time_ms: 1,
  memory_mb: 1,
  stdout: '',
  stderr: '',
  message: '',
});
const finished = (results = ids.map((id) => result(id))) =>
  ({
    task_id: 'task',
    state: 'succeeded',
    result: { testcases: results },
  }) as unknown as TaskInfo;
const event = (id: TestcaseId, verdict = 'accepted') =>
  ({
    task_id: 'task',
    result: { phase: 'testcase_finished', testcase: result(id, verdict) },
  }) as unknown as TaskEvent;
function setup(behavior: ISettings['problem']['expandBehavior'] = 'firstFailed') {
  const problem = new Problem('test', '/source.py');
  for (const id of ids) problem.addTestcase(id, new Testcase());
  const bg = new BackgroundProblem('00000000-0000-0000-0000-000000000010', problem, 0);
  const client = {
    runTask: vi.fn<KernelRpcClient['runTask']>().mockResolvedValue(finished()),
    request: vi.fn().mockResolvedValue({}),
  };
  const problems = {
    save: vi.fn().mockResolvedValue(undefined),
    reference: vi.fn().mockResolvedValue({ problem_id: bg.problemId }),
    enabledTestcaseIds: vi.fn().mockResolvedValue(ids),
  };
  const judge = new RpcJudgeService(
    { forSource: vi.fn().mockResolvedValue(client) } as unknown as KernelService,
    problems as unknown as RpcProblemService,
    { save: vi.fn().mockResolvedValue(undefined) } as unknown as IDocument,
    { problem: { expandBehavior: behavior } } as ISettings,
  );
  return { judge, client, bg, problem };
}

describe('Rust judge controls', () => {
  it.each([true, false, null])(
    'forwards compilation mode %s for every run control',
    async (forceCompile) => {
      for (const [UseCase, type, method] of [
        [RunAllTestcases, 'runAllTestcases', rpcMethod.testcaseRunAll],
        [RunSingleTestcase, 'runSingleTestcase', rpcMethod.testcaseRun],
        [StartStressTest, 'startStressTest', rpcMethod.stressStart],
      ] as const) {
        const { judge, client, bg } = setup();
        const repo = { get: vi.fn().mockResolvedValue(bg), save: vi.fn() };
        const useCase = new UseCase(repo as unknown as IProblemRepository, judge);
        await useCase.exec({
          type,
          problemId: bg.problemId,
          testcaseId: ids[0],
          forceCompile,
        } as never);
        expect(client.runTask.mock.calls[0][0]).toBe(method);
        const params = client.runTask.mock.calls[0][1];
        if (method === rpcMethod.stressStart) {
          expect(params).not.toHaveProperty('testcase_id');
          expect(params).not.toHaveProperty('testcase_ids');
        }
        expect(client.runTask.mock.calls[0][1].compilation).toBe(
          forceCompile === true ? 'force' : forceCompile === false ? 'skip' : 'auto',
        );
      }
    },
  );

  it('cancels one row without aborting the batch and can still stop all rows', async () => {
    const { judge, client, bg, problem } = setup();
    client.runTask.mockImplementation(async (_method, _params, signal, onEvent, onStarted) => {
      await onStarted?.(finished());
      onEvent?.(event(ids[0]));
      await judge.stop(bg, ids[1]);
      expect(signal?.aborted).toBe(false);
      expect(bg.ac).not.toBeNull();
      expect(client.request).toHaveBeenCalledWith(rpcMethod.taskCancel, {
        task_id: 'task',
        testcase_id: ids[1],
      });
      await judge.stop(bg);
      expect(signal?.aborted).toBe(true);
      throw new RpcRemoteError(rpcErrorCode.taskState, 'Task canceled');
    });
    await judge.run(bg);
    expect(problem.getTestcase(ids[0]).result?.verdict).toBe(VerdictName.accepted);
    expect(problem.getTestcase(ids[1]).result?.verdict).toBe(VerdictName.rejected);
  });

  it('retains row cancellation requested before task admission', async () => {
    const { judge, client, bg } = setup();
    client.runTask.mockImplementation(async (_method, _params, signal, _onEvent, onStarted) => {
      expect(client.request).not.toHaveBeenCalled();
      await onStarted?.(finished());
      expect(client.request).toHaveBeenCalledWith(rpcMethod.taskCancel, {
        task_id: 'task',
        testcase_id: ids[1],
      });
      expect(signal?.aborted).toBe(false);
      return finished();
    });
    const running = judge.run(bg);
    await judge.stop(bg, ids[1]);
    await running;
  });

  it.each([
    ['always', [true, true, true]],
    ['never', [false, false, false]],
    ['failed', [false, true, true]],
    ['first', [true, false, false]],
    ['firstFailed', [false, true, false]],
    ['same', [false, false, true]],
  ] as const)(
    'restores %s expansion after out-of-order results and replay',
    async (behavior, expected) => {
      const { judge, client, bg, problem } = setup(behavior);
      problem.getTestcase(ids[2]).isExpand = true;
      client.runTask.mockImplementation(async (_method, _params, _signal, onEvent) => {
        for (const id of [ids[2], ids[1], ids[0]])
          onEvent?.(event(id, id === ids[0] ? 'accepted' : 'wrong_answer'));
        return finished(ids.map((id) => result(id, id === ids[0] ? 'accepted' : 'wrong_answer')));
      });
      await judge.run(bg);
      expect(ids.map((id) => problem.getTestcase(id).isExpand)).toEqual(expected);
    },
  );
});

it.each(['success', 'canceled', 'compilation failure'] as const)(
  'preserves stored testcase results when stress testing ends with %s',
  async (outcome) => {
    const { judge, client, bg, problem } = setup();
    for (const id of ids) problem.getTestcase(id).updateResult({ verdict: VerdictName.accepted });
    const previous = ids.map((id) => ({ ...problem.getTestcase(id).result }));
    client.runTask.mockImplementation(async (_method, params, _signal, onEvent) => {
      expect(params).not.toHaveProperty('testcase_ids');
      expect(ids.map((id) => problem.getTestcase(id).result)).toEqual(previous);
      onEvent?.({ ...event(ids[0]), result: { phase: 'stress_iteration' } } as TaskEvent);
      if (outcome !== 'success')
        throw new RpcRemoteError(
          outcome === 'canceled' ? rpcErrorCode.taskState : rpcErrorCode.compilationFailed,
          outcome,
        );
      return { ...finished([]), result: { found_difference: false } } as TaskInfo;
    });
    await judge.run(bg, undefined, true);
    expect(ids.map((id) => problem.getTestcase(id).result)).toEqual(previous);
    expect(problem.stressTest.state).toBe(
      outcome === 'compilation failure'
        ? StressTestState.compilationError
        : StressTestState.inactive,
    );
  },
);

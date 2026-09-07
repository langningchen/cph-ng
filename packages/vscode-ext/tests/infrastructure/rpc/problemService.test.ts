// biome-ignore-all lint/style/useNamingConvention: RPC fields and named class exports keep their wire/module names.
import type { TestcaseId } from '@cph-ng/core';
import { describe, expect, it, vi } from 'vitest';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { LanguageRegistry } from '@/infrastructure/langs/languageRegistry';
import type { ProblemService as LegacyProblemService } from '@/infrastructure/problems/problemService';
import type { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import type { KernelService } from '@/infrastructure/rpc/kernelService';
import { ProblemPreferences } from '@/infrastructure/rpc/preferences';
import { type ProblemDto, RpcProblemService } from '@/infrastructure/rpc/problemService';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

vi.mock('@/infrastructure/rpc/configuration', async () => ({
  KernelConfiguration: class {},
  languageIds: { 'C++': 'cpp' },
  quoteArgument: (await import('@/infrastructure/rpc/arguments')).quoteArgument,
}));
vi.mock('@/infrastructure/rpc/kernelService', async () => ({
  KernelService: class {},
  splitArguments: (await import('@/infrastructure/rpc/arguments')).splitArguments,
}));
vi.mock('@/infrastructure/langs/languageRegistry', () => ({ LanguageRegistry: class {} }));
vi.mock('@/infrastructure/problems/problemService', () => ({ ProblemService: class {} }));

const first = '00000000-0000-0000-0000-000000000001' as TestcaseId;
const second = '00000000-0000-0000-0000-000000000002' as TestcaseId;
const third = '00000000-0000-0000-0000-000000000003' as TestcaseId;
const fourth = '00000000-0000-0000-0000-000000000004' as TestcaseId;

async function windows() {
  const remote: ProblemDto = {
    id: '00000000-0000-0000-0000-000000000010',
    source_path: '/work/main.cpp',
    name: 'Original',
    url: null,
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    checker: null,
    interactor: null,
    generator: null,
    brute_force: null,
    testcases: [
      { id: first, stdin: '1', answer: 'one' },
      { id: second, stdin: '2', answer: 'two' },
      { id: third, stdin: '3', answer: 'three' },
    ],
  };
  const mutations: Array<{ method: string; params: Record<string, unknown> }> = [];
  const request = async (method: string, params: Record<string, unknown>) => {
    if (method === rpcMethod.problemLoad) return structuredClone(remote);
    if (method === rpcMethod.testcaseList) return structuredClone(remote.testcases);
    if (method === rpcMethod.historyList) return [];
    mutations.push({ method, params: structuredClone(params) });
    if (method === rpcMethod.problemUpdate) {
      const { problem_id: _, ...patch } = params;
      Object.assign(remote, patch);
      return structuredClone(remote);
    }
    if (method === rpcMethod.testcaseAdd) {
      if (remote.testcases.some((testcase) => testcase.id === params.testcase_id))
        throw new Error('Duplicate testcase');
      remote.testcases.push({
        id: String(params.testcase_id),
        stdin: String(params.stdin),
        answer: String(params.answer),
      });
    } else if (method === rpcMethod.testcaseDelete) {
      remote.testcases = remote.testcases.filter((testcase) => testcase.id !== params.testcase_id);
    } else if (method === rpcMethod.testcaseUpdate) {
      const testcase = remote.testcases.find((item) => item.id === params.testcase_id);
      if (!testcase) throw new Error('Missing testcase');
      if ('stdin' in params) testcase.stdin = String(params.stdin);
      if ('answer' in params) testcase.answer = String(params.answer);
    } else if (method === rpcMethod.testcaseReorder) {
      const order = params.testcase_ids as string[];
      if (
        order.length !== remote.testcases.length ||
        new Set(order).size !== order.length ||
        remote.testcases.some((testcase) => !order.includes(testcase.id))
      )
        throw new Error('Order omitted a remote testcase');
      remote.testcases.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else throw new Error(`Unexpected mutation ${method}`);
    return {};
  };
  function windowService() {
    const preferenceData = new Map<string, unknown>();
    const kernel = {
      forSource: async () => ({ request }),
      preferences: new ProblemPreferences({
        get<T>(key: string) {
          return preferenceData.get(key) as T | undefined;
        },
        async update(key: string, value: unknown) {
          preferenceData.set(key, value);
        },
      }),
    } as unknown as KernelService;
    const configuration = {
      get: async () => ({
        config: { problem: { time_limit: 1000, memory_limit: 256 }, languages: {} },
        local_config: {},
      }),
    } as unknown as KernelConfiguration;
    const languages = { getLangByFile: () => ({ name: 'C++' }) } as unknown as LanguageRegistry;
    const legacy = {
      getLimits: (problem: Problem) => ({
        timeLimitMs: problem.overrides.timeLimitMs ?? 1000,
        memoryLimitMb: problem.overrides.memoryLimitMb ?? 256,
      }),
    } as LegacyProblemService;
    const io = { readContent: async (value: TestcaseIo) => value.data ?? '' } as ITestcaseIoService;
    return new RpcProblemService(configuration, languages, kernel, legacy, io);
  }
  const a = windowService(),
    b = windowService();
  const left = await a.loadBySrc(remote.source_path),
    right = await b.loadBySrc(remote.source_path);
  if (!left || !right) throw new Error('Fixture problem was not loaded');
  return { a, b, left, right, remote, mutations };
}

describe('two windows sharing a kernel', () => {
  it('does not persist a stale view when obtaining run/history references and runs newly added cases', async () => {
    const { a, b, left, right, remote, mutations } = await windows();
    left.name = 'Renamed elsewhere';
    left.overrides.timeLimitMs = 2500;
    left.addTestcase(
      fourth,
      new Testcase(new TestcaseIo({ data: '4' }), new TestcaseIo({ data: 'four' })),
    );
    await a.save(left);
    mutations.length = 0;
    expect(await b.reference(right)).toEqual({
      problem_id: remote.id,
      source_path: right.src.path,
    });
    await b.history(right);
    expect(await b.enabledTestcaseIds(right)).toEqual([first, second, third, fourth]);
    expect(remote.name).toBe('Renamed elsewhere');
    expect(remote.time_limit_ms).toBe(2500);
    expect(mutations).toEqual([]);
  });

  it('keeps UI-only saves local and only updates the edited input without overwriting a remote answer', async () => {
    const { a, b, left, right, remote, mutations } = await windows();
    left.getTestcase(first).answer = new TestcaseIo({ data: 'updated by A' });
    left.addTestcase(
      fourth,
      new Testcase(new TestcaseIo({ data: '4' }), new TestcaseIo({ data: 'four' })),
    );
    await a.save(left);
    mutations.length = 0;
    right.getTestcase(first).isExpand = true;
    right.getTestcase(second).isDisabled = true;
    await b.save(right);
    expect(mutations).toEqual([]);
    right.getTestcase(first).stdin = new TestcaseIo({ data: 'edited by B' });
    await b.save(right);
    expect(mutations).toEqual([
      {
        method: rpcMethod.testcaseUpdate,
        params: { problem_id: remote.id, testcase_id: first, stdin: 'edited by B' },
      },
    ]);
    expect(remote.testcases.find((testcase) => testcase.id === first)).toEqual({
      id: first,
      stdin: 'edited by B',
      answer: 'updated by A',
    });
    expect(remote.testcases.map((testcase) => testcase.id)).toContain(fourth);
    mutations.length = 0;
    await b.save(right);
    expect(mutations).toEqual([]);
    expect(await b.enabledTestcaseIds(right)).toEqual([first, third, fourth]);
    expect(right.getTestcase(first).answer.data).toBe('updated by A');
    expect(mutations).toEqual([]);
  });

  it('deletes only explicitly removed original cases and preserves remote additions during a local reorder', async () => {
    const { a, b, left, right, remote } = await windows();
    left.addTestcase(fourth, new Testcase());
    await a.save(left);
    right.deleteTestcase(second);
    right.moveTestcase(0, 1);
    await b.save(right);
    expect(remote.testcases.map((testcase) => testcase.id)).toEqual([third, first, fourth]);
  });

  it('reports conflicting edits and conflicting reorders before sending mutations', async () => {
    const { a, b, left, right, remote, mutations } = await windows();
    left.name = 'A';
    await a.save(left);
    mutations.length = 0;
    right.name = 'B';
    await expect(b.save(right)).rejects.toThrow('another window');
    expect(remote.name).toBe('A');
    expect(mutations).toEqual([]);
    const fresh = await windows();
    fresh.left.moveTestcase(0, 1);
    await fresh.a.save(fresh.left);
    fresh.mutations.length = 0;
    fresh.right.moveTestcase(2, 1);
    await expect(fresh.b.save(fresh.right)).rejects.toThrow('Testcase order');
    expect(fresh.mutations).toEqual([]);
  });

  it('does not undo a remote reorder when this window appends a testcase', async () => {
    const { a, b, left, right, remote } = await windows();
    left.moveTestcase(2, 0);
    await a.save(left);
    right.addTestcase(fourth, new Testcase());
    await b.save(right);
    expect(remote.testcases.map((testcase) => testcase.id)).toEqual([third, first, second, fourth]);
  });

  it('awaits pending local writes before a run reference and never resurrects remotely deleted testcases', async () => {
    const { a, b, left, right, remote, mutations } = await windows();
    left.name = 'Saved before running';
    const save = a.save(left);
    await a.reference(left);
    expect(remote.name).toBe('Saved before running');
    await save;
    left.deleteTestcase(first);
    await a.save(left);
    mutations.length = 0;
    right.getTestcase(first).stdin = new TestcaseIo({ data: 'stale edit' });
    await expect(b.save(right)).rejects.toThrow('another window');
    expect(mutations).toEqual([]);
    expect(remote.testcases.map((testcase) => testcase.id)).not.toContain(first);
  });
});

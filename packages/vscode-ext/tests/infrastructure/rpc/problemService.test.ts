// biome-ignore-all lint/style/useNamingConvention: RPC fields and named class exports keep their wire/module names.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProblemId, TestcaseId } from '@cph-ng/core';
import { describe, expect, it, vi } from 'vitest';
import type { IClock } from '@/application/ports/node/IClock';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ISidebarProvider } from '@/application/ports/vscode/ISidebarProvider';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { LanguageRegistry } from '@/infrastructure/langs/languageRegistry';
import { ProblemRepository } from '@/infrastructure/problems/problemRepository';
import type { ProblemService as LegacyProblemService } from '@/infrastructure/problems/problemService';
import { RpcRemoteError } from '@/infrastructure/rpc/client';
import type { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { RpcJudgeService } from '@/infrastructure/rpc/judgeService';
import type { KernelService } from '@/infrastructure/rpc/kernelService';
import { editorPath } from '@/infrastructure/rpc/paths';
import { ProblemPreferences } from '@/infrastructure/rpc/preferences';
import { type ProblemDto, RpcProblemService } from '@/infrastructure/rpc/problemService';
import { rpcErrorCode, rpcMethod } from '@/infrastructure/rpc/protocol';

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

async function windows(paths: Partial<ProblemDto> = {}) {
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
    ...paths,
    testcases: [
      { id: first, stdin: '1', answer: 'one' },
      { id: second, stdin: '2', answer: 'two' },
      { id: third, stdin: '3', answer: 'three' },
    ],
  };
  let present = true;
  const legacyLoad = vi.fn(async (): Promise<Problem | null> => null);
  const legacyDelete = vi.fn(async () => {
    legacyLoad.mockResolvedValue(null);
  });
  const configs = new Map<string, Record<string, unknown>>();
  const configure = vi.fn(async (change: { patch: Record<string, unknown> }, source: string) => {
    configs.set(editorPath(source), structuredClone(change.patch));
  });
  const attached = new Set<string>();
  const runTask = vi.fn(async () => ({ state: 'succeeded', result: { testcases: [] } }));
  const mutations: Array<{ method: string; params: Record<string, unknown> }> = [];
  const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === rpcMethod.problemLoad) {
      if (!present) throw new RpcRemoteError(rpcErrorCode.notIndexed, 'No problem');
      return structuredClone(remote);
    }
    if (method === rpcMethod.problemDelete) {
      present = false;
      return {};
    }
    if (method === rpcMethod.testcaseList) return structuredClone(remote.testcases);
    if (method === rpcMethod.historyList) return [];
    mutations.push({ method, params: structuredClone(params) });
    if (method === rpcMethod.problemCreate || method === rpcMethod.problemImport) {
      remote.id = '00000000-0000-0000-0000-000000000020';
      remote.source_path = String(params.source_path);
      const imported = params.problem as
        | { name: string; tests: Array<{ id: string; input: string; output: string }> }
        | undefined;
      remote.name = imported?.name ?? String(params.name);
      remote.testcases =
        imported?.tests.map((test) => ({ id: test.id, stdin: test.input, answer: test.output })) ??
        [];
      return structuredClone(remote);
    }
    if (method === rpcMethod.problemUpdate) {
      for (const field of ['checker', 'interactor', 'generator', 'brute_force'])
        if (typeof params[field] === 'string' && !attached.has(params[field] as string))
          throw new Error('Auxiliary source is outside attached roots');
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
  });
  const forSource = vi.fn(async (source: string) => {
    attached.add(source);
    return { request, runTask };
  });
  function windowService() {
    const preferenceData = new Map<string, unknown>();
    const kernel = {
      forSource,
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
      get: async (source?: string) => ({
        config: { problem: { time_limit: 1000, memory_limit: 256 }, languages: {} },
        local_config: source ? (configs.get(editorPath(source)) ?? {}) : {},
      }),
      set: configure,
    } as unknown as KernelConfiguration;
    const languages = { getLangByFile: () => ({ name: 'C++' }) } as unknown as LanguageRegistry;
    const legacy = {
      loadBySrc: legacyLoad,
      delete: legacyDelete,
      getLimits: (problem: Problem) => ({
        timeLimitMs: problem.overrides.timeLimitMs ?? 1000,
        memoryLimitMb: problem.overrides.memoryLimitMb ?? 256,
      }),
    } as unknown as LegacyProblemService;
    const io = {
      readContent: async (value: TestcaseIo) =>
        value.path ? readFile(value.path, 'utf8') : (value.data ?? ''),
    } as ITestcaseIoService;
    return new RpcProblemService(configuration, languages, kernel, legacy, io);
  }
  const a = windowService(),
    b = windowService();
  const left = await a.loadBySrc(remote.source_path),
    right = await b.loadBySrc(remote.source_path);
  if (!left || !right) throw new Error('Fixture problem was not loaded');
  return {
    a,
    b,
    left,
    right,
    remote,
    mutations,
    forSource,
    attached,
    runTask,
    legacyLoad,
    legacyDelete,
    request,
    configs,
    configure,
  };
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

it.each([true, false])('synchronizes disk edits before a run (single=%s)', async (single) => {
  const { a, b, left, right, remote, forSource, runTask } = await windows();
  const directory = await mkdtemp(join(tmpdir(), 'cph-testcase-sync-'));
  try {
    const input = join(directory, 'input.txt');
    await writeFile(input, '1');
    right.getTestcase(first).stdin = new TestcaseIo({ path: input });
    await b.save(right);
    left.getTestcase(first).answer = new TestcaseIo({ data: 'remote answer' });
    await a.save(left);
    await writeFile(input, 'edited on disk');
    const judge = new RpcJudgeService(
      { forSource } as unknown as KernelService,
      b,
      { save: vi.fn().mockResolvedValue(undefined) } as unknown as IDocument,
      { problem: { expandBehavior: 'same' } } as ISettings,
    );
    let judged: ProblemDto['testcases'] | undefined;
    runTask.mockImplementation(async () => {
      judged = structuredClone(remote.testcases);
      return { state: 'succeeded', result: { testcases: [] } };
    });
    await judge.run(
      new BackgroundProblem(remote.id as ProblemId, right, 0),
      single ? first : undefined,
    );
    expect(judged?.find((testcase) => testcase.id === first)).toEqual({
      id: first,
      stdin: 'edited on disk',
      answer: 'remote answer',
    });
    expect(runTask).toHaveBeenCalledOnce();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('attaches selected auxiliary sources before saving and reattaches them on unchanged saves', async () => {
  const { a, left, attached, mutations } = await windows();
  left.checker = { path: '/checker/check.py', hash: null };
  left.interactor = { path: '/interactor/interact.py', hash: null };
  left.stressTest.generator = { path: '/generator/gen.py', hash: null };
  left.stressTest.bruteForce = { path: '/brute/solve.py', hash: null };
  const sources = [
    left.checker.path,
    left.interactor.path,
    left.stressTest.generator.path,
    left.stressTest.bruteForce.path,
  ];
  await a.save(left);
  expect(sources.every((source) => attached.has(source))).toBe(true);
  attached.clear();
  mutations.length = 0;
  await a.save(left);
  expect(sources.every((source) => attached.has(source))).toBe(true);
  expect(mutations).toEqual([]);
});

it('normalizes Windows kernel paths for editor matching without spurious auxiliary updates', async () => {
  vi.stubGlobal('process', { ...process, platform: 'win32' });
  try {
    const { a, left, mutations } = await windows({
      source_path: String.raw`\\?\C:\work\Main.cpp`,
      checker: String.raw`\\?\UNC\server\share\checker.cpp`,
      interactor: String.raw`\\?\C:\tools\interactor.cpp`,
      generator: String.raw`\\?\C:\tools\generator.cpp`,
      brute_force: String.raw`\\?\C:\tools\brute.cpp`,
    });
    expect(left.src.path).toBe(String.raw`c:\work\Main.cpp`);
    for (const path of [
      String.raw`c:\work\Main.cpp`,
      String.raw`\\server\share\checker.cpp`,
      String.raw`c:\tools\interactor.cpp`,
      String.raw`c:\tools\generator.cpp`,
      String.raw`c:\tools\brute.cpp`,
    ])
      expect(left.isRelated(path)).toBe(true);
    await a.save(left);
    expect(mutations).toEqual([]);
    left.name = 'Renamed';
    await a.save(left);
    expect(mutations).toEqual([
      {
        method: rpcMethod.problemUpdate,
        params: { problem_id: '00000000-0000-0000-0000-000000000010', name: 'Renamed' },
      },
    ]);
    const save = vi.fn(async () => {});
    const judge = new RpcJudgeService(
      {
        forSource: async () => ({
          runTask: async () => ({ state: 'succeeded', result: { testcases: [] } }),
        }),
      } as unknown as KernelService,
      a,
      { save } as unknown as IDocument,
      { problem: { expandBehavior: 'firstFailed' } } as ISettings,
    );
    await judge.run(
      new BackgroundProblem('00000000-0000-0000-0000-000000000010' as ProblemId, left, 0),
      first,
    );
    expect(save).toHaveBeenCalledWith(String.raw`c:\work\Main.cpp`);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('retires legacy metadata before deleting a migrated problem so editor refresh cannot reimport it', async () => {
  const { a, b, left, legacyLoad, legacyDelete } = await windows();
  legacyLoad.mockResolvedValue(left);
  await a.delete(left);
  expect(legacyDelete).toHaveBeenCalledWith(left);
  expect(await a.loadBySrc(left.src.path)).toBeNull();
  expect(await b.loadBySrc(left.src.path)).toBeNull();
});

it('keeps automatic identity conflicts visible while allowing explicit creation of a template copy', async () => {
  const { a, request } = await windows();
  const logger = { withScope: () => logger, debug: () => {}, error: () => {} };
  const repository = new ProblemRepository(
    { now: () => 0 } as IClock,
    { randomUUID: () => 'new-editor-id' } as unknown as ICrypto,
    logger as unknown as ILogger,
    a,
    {} as IActivePathService,
    { sendMessage: () => {} } as unknown as ISidebarProvider,
  );
  request.mockRejectedValueOnce(new RpcRemoteError(rpcErrorCode.conflict, 'Ambiguous source'));
  request.mockRejectedValueOnce(new RpcRemoteError(rpcErrorCode.conflict, 'Ambiguous source'));
  const automatic = repository.loadByPath('/work/template.cpp');
  const explicit = repository.loadByPath('/work/template.cpp', true);
  const [auto, created] = await Promise.allSettled([automatic, explicit]);
  expect(auto.status).toBe('rejected');
  expect(created.status).toBe('fulfilled');
  if (created.status === 'fulfilled') expect(created.value?.problem.name).toBe('template');
  expect(request).toHaveBeenCalledWith(rpcMethod.problemCreate, {
    source_path: '/work/template.cpp',
    name: 'template',
  });
});

it('copies problem-local kernel configuration without applying legacy overrides during ordinary saves', async () => {
  const { a, left, configs, configure } = await windows();
  const local = {
    languages: {
      cpp: {
        compiler: 'g++',
        compiler_args: ['-std=c++20'],
        interpreter: 'runner',
        interpreter_args: ['--trace'],
      },
    },
    judge: { checker_mode: 'exact' },
  };
  configs.set(left.src.path, local);
  const copied = new Problem('Copy', '/work/copy.cpp');
  copied.overrides = { ...left.overrides, compilerArgs: '-std=c++20' };
  await a.save(copied, left);
  expect(configure).toHaveBeenCalledWith({ patch: local }, copied.src.path);
  const reopened = await a.loadBySrc(copied.src.path);
  expect(reopened?.overrides.compilerArgs).toBe('-std=c++20');
  expect(reopened?.overrides.interpreterArgs).toBe('--trace');
  configure.mockClear();
  await a.save(copied);
  expect(configure).not.toHaveBeenCalled();
});

it('registers one background instance when automatic and explicit loads overlap', async () => {
  const { a } = await windows();
  const logger = { withScope: () => logger, debug: () => {}, error: () => {} };
  let sequence = 0;
  const sendMessage = vi.fn();
  const repository = new ProblemRepository(
    { now: () => 0 } as IClock,
    { randomUUID: () => `editor-${++sequence}` } as unknown as ICrypto,
    logger as unknown as ILogger,
    a,
    {} as IActivePathService,
    { sendMessage } as unknown as ISidebarProvider,
  );
  const source = editorPath('/work/main.cpp');
  const [automatic, explicit] = await Promise.all([
    repository.loadByPath(source),
    repository.loadByPath(source, true),
  ]);
  expect(automatic).not.toBeNull();
  expect(automatic).toBe(explicit);
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

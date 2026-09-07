// biome-ignore-all lint/style/useNamingConvention: Requests exercise the Rust wire schema.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ProblemId, StressTestState, type TestcaseId, VerdictName } from '@cph-ng/core';
import { expect, it, vi } from 'vitest';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { KernelRpcClient } from '@/infrastructure/rpc/client';
import { RpcJudgeService } from '@/infrastructure/rpc/judgeService';
import type { KernelService } from '@/infrastructure/rpc/kernelService';
import type { ProblemDto, RpcProblemService } from '@/infrastructure/rpc/problemService';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

vi.mock('@/infrastructure/rpc/kernelService', () => ({ KernelService: class {} }));
vi.mock('@/infrastructure/rpc/problemService', () => ({ RpcProblemService: class {} }));

it.skipIf(!process.env.CPH_NG_JUDGE)(
  'starts stress testing through the editor service and preserves stored testcase results',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-editor-stress-'));
    const client = new KernelRpcClient({
      command: process.env.CPH_NG_JUDGE ?? 'cph-ng-judge',
      args: ['serve', '--store-root', root],
    });
    try {
      const source = join(root, 'solution.py');
      const generator = join(root, 'generator.py');
      const brute = join(root, 'brute.py');
      await Promise.all([
        writeFile(source, 'print(sum(map(int, input().split())))\n'),
        writeFile(generator, "print('1 2')\n"),
        writeFile(brute, 'a,b=map(int,input().split()); print(a-b)\n'),
      ]);
      const dto = await client.request<ProblemDto>(rpcMethod.problemImport, {
        source_path: source,
        format: 'companion',
        problem: { name: 'Sum', timeLimit: 5000, tests: [{ input: '1 2', output: '3' }] },
      });
      await client.request(rpcMethod.problemUpdate, {
        problem_id: dto.id,
        generator,
        brute_force: brute,
      });
      const problem = new Problem('Sum', source);
      const savedId = dto.testcases[0].id as TestcaseId;
      const saved = new Testcase();
      saved.updateResult({ verdict: VerdictName.accepted, timeMs: 17 });
      problem.addTestcase(savedId, saved);
      const judge = new RpcJudgeService(
        { forSource: async () => client } as unknown as KernelService,
        {
          save: async () => {},
          reference: async () => ({ problem_id: dto.id, source_path: source }),
        } as unknown as RpcProblemService,
        { save: async () => {} } as unknown as IDocument,
        { problem: { expandBehavior: 'firstFailed' } } as ISettings,
      );
      await judge.run(new BackgroundProblem(dto.id as ProblemId, problem, 0), undefined, true);
      expect(problem.stressTest.state).toBe(StressTestState.foundDifference);
      expect(problem.testcases.size).toBe(2);
      expect(problem.getTestcase(savedId).result).toMatchObject({
        verdict: VerdictName.accepted,
        timeMs: 17,
      });
      expect(
        [...problem.testcases.values()].some(
          (testcase) => testcase.result?.verdict === VerdictName.wrongAnswer,
        ),
      ).toBe(true);
    } finally {
      await client.dispose();
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000,
);

// biome-ignore-all lint/style/useNamingConvention: These requests exercise the Rust wire schema.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { KernelRpcClient, type TaskInfo } from '@/infrastructure/rpc/client';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

it.skipIf(!process.env.CPH_NG_JUDGE)(
  'runs the TypeScript client against a real Rust server and replays persisted results',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-rpc-client-'));
    let client: KernelRpcClient | undefined;
    const connect = () =>
      new KernelRpcClient({
        command: process.env.CPH_NG_JUDGE ?? 'cph-ng-judge',
        args: ['serve', '--store-root', root],
      });
    try {
      client = connect();
      const capabilities = await client.request<{ methods: string[] }>(
        rpcMethod.systemCapabilities,
      );
      expect(capabilities.methods).toEqual(expect.arrayContaining(Object.values(rpcMethod)));
      const source = join(root, 'solution.py');
      await writeFile(source, 'print(sum(map(int,input().split())))\n');
      const problem = await client.request<{ id: string }>(rpcMethod.problemImport, {
        source_path: source,
        format: 'companion',
        problem: { name: 'Sum', tests: [{ input: '2 3', output: '5' }] },
      });
      const result = await client.runTask(rpcMethod.testcaseRunAll, {
        problem_id: problem.id,
      });
      expect(result.state).toBe('succeeded');
      expect(result.result?.verdict).toBe('accepted');
      await client.dispose();
      client = connect();
      const history = await client.request<TaskInfo>(rpcMethod.historyLoad, {
        run_id: result.task_id,
      });
      expect(history.result?.verdict).toBe('accepted');
    } finally {
      await client?.dispose();
      await rm(root, { recursive: true, force: true });
    }
  },
  20_000,
);

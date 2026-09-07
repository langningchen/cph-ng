// biome-ignore-all lint/style/useNamingConvention: Requests exercise the Rust wire schema.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { KernelRpcClient, TaskInfo } from '@/infrastructure/rpc/client';
import { connectSharedKernel } from '@/infrastructure/rpc/daemon';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

it.skipIf(!process.env.CPH_NG_JUDGE)(
  'shares a real kernel across windows and keeps tasks alive when a window closes',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-daemon-'));
    const firstWorkspace = await mkdtemp(join(tmpdir(), 'cph-first-'));
    const secondWorkspace = await mkdtemp(join(tmpdir(), 'cph-second-'));
    const clients: KernelRpcClient[] = [];
    try {
      const [first, second] = await Promise.all(
        [firstWorkspace, secondWorkspace].map((workspace) =>
          connectSharedKernel(
            process.env.CPH_NG_JUDGE ?? 'cph-ng-judge',
            root,
            [workspace],
            () => {},
          ),
        ),
      );
      clients.push(first, second);
      const source = join(firstWorkspace, 'solution.py');
      const other = join(secondWorkspace, 'other.py');
      await writeFile(source, 'import time; time.sleep(.2); print(7)\n');
      await writeFile(other, 'print(1)\n');
      const problem = await first.request<{ id: string }>(rpcMethod.problemCreate, {
        source_path: source,
      });
      await second.request(rpcMethod.problemCreate, { source_path: other });
      await first.request(rpcMethod.testcaseAdd, { problem_id: problem.id, answer: '7' });
      const task = await first.request<TaskInfo>(rpcMethod.judgeRun, { problem_id: problem.id });
      await first.dispose();
      const result = await second.waitTask(task.task_id);
      expect(result.result?.verdict).toBe('accepted');
      expect(await second.request(rpcMethod.problemList)).toHaveLength(2);
      const disconnected = new Promise<void>((resolve) =>
        second.events.once('disconnected', resolve),
      );
      await second.request(rpcMethod.systemShutdown);
      await disconnected;
      // The same client can start a replacement daemon and reattach its roots.
      expect(await second.request(rpcMethod.problemList)).toHaveLength(2);
    } finally {
      const active = clients.at(-1);
      if (active) {
        const disconnected = new Promise<void>((resolve) =>
          active.events.once('disconnected', resolve),
        );
        await active.request(rpcMethod.systemShutdown).catch(() => {});
        await Promise.race([
          disconnected,
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
      }
      await Promise.all(clients.map((client) => client.dispose()));
      await Promise.all(
        [root, firstWorkspace, secondWorkspace].map((path) =>
          rm(path, { recursive: true, force: true }),
        ),
      );
    }
  },
  30_000,
);

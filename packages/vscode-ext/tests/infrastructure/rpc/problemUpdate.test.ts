// biome-ignore-all lint/style/useNamingConvention: RPC fields follow the Rust wire schema.
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import type { KernelRpcClient } from '@/infrastructure/rpc/client';
import type { KernelService } from '@/infrastructure/rpc/kernelService';
import { updateProblem } from '@/infrastructure/rpc/problemUpdate';
import { rpcMethod } from '@/infrastructure/rpc/protocol';

it.each([false, true])(
  'transfers large batches by file and cleans up after failure=%s',
  async (fail) => {
    const root = await mkdtemp(join(tmpdir(), 'cph-large-save-'));
    const testcases = [{ id: 'case', stdin: 'x'.repeat(4 * 1024 * 1024), answer: '' }];
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      expect(method).toBe(rpcMethod.problemUpdate);
      expect(params.expected_revision).toBe('current');
      expect(params.testcases).toBeUndefined();
      expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThan(4 * 1024 * 1024);
      expect(JSON.parse(await readFile(String(params.testcases_file), 'utf8'))).toEqual(testcases);
      if (fail) throw new Error('save failed');
    });
    try {
      const save = updateProblem(
        { request } as unknown as KernelRpcClient,
        { storeRoot: root } as KernelService,
        { problem_id: 'problem', expected_revision: 'current', testcases },
      );
      if (fail) await expect(save).rejects.toThrow('save failed');
      else await save;
      expect(request).toHaveBeenCalledOnce();
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

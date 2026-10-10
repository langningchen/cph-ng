// biome-ignore-all lint/style/useNamingConvention: RPC fields follow the Rust wire schema.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KernelRpcClient } from './client';
import type { KernelService } from './kernelService';
import { rpcMethod } from './protocol';

/** Keep batch saves atomic without exceeding the existing RPC frame budget. */
export async function updateProblem(
  client: KernelRpcClient,
  kernel: KernelService,
  params: Record<string, unknown>,
): Promise<void> {
  if (Buffer.byteLength(JSON.stringify(params)) < 4 * 1024 * 1024 - 1024) {
    await client.request(rpcMethod.problemUpdate, params);
    return;
  }
  const directory = await mkdtemp(join(kernel.storeRoot, 'problem-save-'));
  const path = join(directory, 'testcases.json');
  try {
    const { testcases, ...details } = params;
    await writeFile(path, JSON.stringify(testcases), { flag: 'wx', mode: 0o600 });
    await client.request(rpcMethod.problemUpdate, { ...details, testcases_file: path });
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

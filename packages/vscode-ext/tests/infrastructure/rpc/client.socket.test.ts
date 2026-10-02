// biome-ignore-all lint/style/useNamingConvention: Requests exercise the Rust wire schema.
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { expect, it } from 'vitest';
import { KernelRpcClient } from '@/infrastructure/rpc/client';
import { rpcEventMethod, rpcMethod } from '@/infrastructure/rpc/protocol';

it('shares an IPC server, reattaches after disconnect and never shuts it down on disposal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cph-client-ipc-'));
  const endpoint =
    process.platform === 'win32' ? `\\\\.\\pipe\\cph-test-${randomUUID()}` : join(root, 'rpc.sock');
  const sockets = new Set<Socket>();
  const attached: unknown[] = [];
  let shutdowns = 0;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    const send = (data: unknown) => socket.write(`${JSON.stringify(data)}\n`);
    send({ jsonrpc: '2.0', method: rpcEventMethod.serverReady });
    createInterface({ input: socket }).on('line', (line) => {
      const request = JSON.parse(line);
      if (request.method === rpcMethod.systemAttach) attached.push(request.params);
      if (request.method === rpcMethod.systemShutdown) shutdowns++;
      send({
        jsonrpc: '2.0',
        id: request.id,
        result:
          request.method === rpcMethod.systemHello ? { protocol_version: '1.0' } : { ok: true },
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(endpoint, resolve);
  });
  const create = (workspace: string) =>
    new KernelRpcClient({ command: '', args: [], endpoint, workspaceRoots: [workspace] });
  const first = create('first');
  const second = create('second');
  try {
    await Promise.all([first.connect(), second.connect()]);
    await first.dispose();
    expect(await second.request(rpcMethod.systemPing)).toEqual({ ok: true });
    const disconnected = new Promise<void>((resolve) =>
      second.events.once('disconnected', resolve),
    );
    for (const socket of sockets) socket.destroy();
    await disconnected;
    expect(await second.request(rpcMethod.systemPing)).toEqual({ ok: true });
    expect(attached).toEqual(
      expect.arrayContaining([{ workspace_roots: ['first'] }, { workspace_roots: ['second'] }]),
    );
    expect(attached).toHaveLength(3);
    expect(shutdowns).toBe(0);
  } finally {
    await first.dispose();
    await second.dispose();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

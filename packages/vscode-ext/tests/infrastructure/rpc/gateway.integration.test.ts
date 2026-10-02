// biome-ignore-all lint/style/useNamingConvention: Requests exercise the gateway wire schema.
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { GatewayClient } from '@/infrastructure/services/companion/gatewayClient';

interface Notification {
  method: string;
  params: Record<string, unknown>;
}
interface BrowserMessage extends Partial<Notification> {
  id?: number;
  result?: Record<string, unknown>;
  error?: unknown;
}
async function until<T>(read: () => T | undefined, message: string): Promise<T> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = read();
    if (result !== undefined) return result;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}
async function availablePort(): Promise<number> {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  return address.port;
}
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit', { signal: AbortSignal.timeout(5000) });
  child.kill();
  await exited;
}
function editor(port: number, token: string) {
  const client = new GatewayClient(port, token);
  const notifications: Notification[] = [];
  client.events.on('notification', (method: string, params: Record<string, unknown>) => {
    notifications.push({ method, params });
  });
  return {
    client,
    notifications,
    notification: (
      method: string,
      since = 0,
      matches: (params: Record<string, unknown>) => boolean = () => true,
    ) =>
      until(
        () =>
          notifications
            .slice(since)
            .find((entry) => entry.method === method && matches(entry.params)),
        `Missing editor notification: ${method}`,
      ),
  };
}
async function browser(port: number, token: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages: BrowserMessage[] = [];
  socket.addEventListener('message', ({ data }) =>
    messages.push(JSON.parse(String(data)) as BrowserMessage),
  );
  await until(
    () => (socket.readyState === WebSocket.OPEN ? true : undefined),
    'Browser WebSocket did not open',
  );
  socket.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'router.hello',
      params: { role: 'browser', token },
    }),
  );
  const hello = await until(
    () => messages.find((message) => message.id === 1),
    'Missing browser hello response',
  );
  expect(hello.error).toBeUndefined();
  expect(hello.result?.protocol_version).toBe('1.0');
  return { socket, messages };
}

it.skipIf(!process.env.CPH_NG_JUDGE)(
  'connects editor and browser clients through the real Rust gateway and recovers after restart',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-gateway-client-'));
    const binary = process.env.CPH_NG_JUDGE ?? 'cph-ng-judge';
    const port = await availablePort();
    const args = ['--store-root', root, 'router'];
    const editors: ReturnType<typeof editor>[] = [];
    const browsers: WebSocket[] = [];
    let child: ChildProcess | undefined;
    const start = async () => {
      let diagnostics = '';
      child = spawn(binary, [...args, 'serve'], {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        diagnostics += chunk.toString();
      });
      await until(() => {
        if (child?.exitCode !== null && child?.exitCode !== undefined)
          throw new Error(`Gateway exited: ${diagnostics}`);
        return diagnostics.includes('Companion gateway listening') ? true : undefined;
      }, 'Rust gateway did not start');
    };
    try {
      await promisify(execFile)(binary, [...args, 'set', '--port', String(port)]);
      const info = await promisify(execFile)(binary, [...args, 'info']);
      const { token } = JSON.parse(info.stdout) as { token: string };
      await start();
      const first = editor(port, token);
      const second = editor(port, token);
      editors.push(first, second);
      for (const { client } of editors) client.connect();
      await until(
        () => (editors.every(({ client }) => client.connected) ? true : undefined),
        'Editors did not authenticate',
      );

      const active = await browser(port, token);
      browsers.push(active.socket);
      await until(
        () =>
          active.messages.find(
            (message) =>
              message.method === 'event.router.status' && message.params?.isActive === true,
          ),
        'Browser did not become active',
      );
      await first.notification(
        'event.router.browser_status',
        0,
        (params) => params.connected === true,
      );
      const problem = {
        name: 'A + B',
        url: 'https://example.com/problem',
        timeLimit: 1000,
        memoryLimit: 256,
        tests: [{ input: '1 2', output: '3' }],
        batch: { id: 'integration-batch', size: 1 },
      };
      const imported = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problem),
      });
      expect(imported.status).toBe(200);
      expect(await imported.json()).toEqual({ status: 'ok' });
      const available = await Promise.all(
        editors.map((entry) => entry.notification('event.router.batch_available')),
      );
      for (const entry of available)
        expect(entry.params).toMatchObject({
          batchId: 'integration-batch',
          problems: [problem],
          autoImport: false,
        });
      const claims = await Promise.allSettled(
        editors.map(({ client }) =>
          client.request('router.claim_batch', { batchId: 'integration-batch' }),
        ),
      );
      expect(claims.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(claims.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const winner = editors.at(claims.findIndex((result) => result.status === 'fulfilled'));
      if (!winner) throw new Error('No editor claimed the batch');
      expect(
        await winner.client.request('router.complete_batch', { batchId: 'integration-batch' }),
      ).toEqual({ removed: true });

      const submission = { url: 'https://example.com/problem', sourceCode: 'int main() {}' };
      expect(await second.client.request('router.submit', submission)).toEqual({ forwarded: true });
      const forwarded = await until(
        () => active.messages.find((message) => message.method === 'event.router.submit_request'),
        'Submission was not forwarded to the local browser socket',
      );
      expect(forwarded.params).toEqual(submission);
      const beforeClose = first.notifications.length;
      active.socket.close();
      await first.notification(
        'event.router.browser_status',
        beforeClose,
        (params) => params.connected === false,
      );

      await stop(child);
      await until(
        () => (editors.every(({ client }) => !client.connected) ? true : undefined),
        'Editors did not observe gateway disconnect',
      );
      await start();
      await until(
        () => (editors.every(({ client }) => client.connected) ? true : undefined),
        'Editors did not automatically reconnect',
      );
      expect(await first.client.request('system.ping')).toEqual({ ok: true });
      const beforeReconnect = first.notifications.length;
      const reconnected = await browser(port, token);
      browsers.push(reconnected.socket);
      await first.notification(
        'event.router.browser_status',
        beforeReconnect,
        (params) => params.connected === true,
      );
      first.client.close();
      await until(
        () => (!first.client.connected ? true : undefined),
        'Closed editor did not disconnect',
      );
      expect(await second.client.request('system.ping')).toEqual({ ok: true });
    } finally {
      for (const { client } of editors) client.close();
      for (const socket of browsers) socket.close();
      await stop(child);
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000,
);

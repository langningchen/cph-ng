import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { RouterConfig } from '@cph-ng/core';
import { cryptoMock } from '@t/infrastructure/node/cryptoMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { systemMock } from '@t/infrastructure/node/systemMock';
import { PathResolverMock } from '@t/infrastructure/services/pathResolverMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { CompanionCommunicationService } from '@v/infrastructure/services/companion/companionCommunicationService';
import type { Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ioMock, spawnMock } = vi.hoisted(() => ({
  ioMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

class FakeChildProcess extends EventEmitter {
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public readonly pid = 4242;
  public killed = false;
  public exitCode: number | null = null;
  public signalCode: NodeJS.Signals | null = null;
  public readonly killCalls: NodeJS.Signals[] = [];

  public kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true;
    this.killCalls.push(signal);
    queueMicrotask(() => {
      this.signalCode = signal;
      this.emit('exit', null, signal);
    });
    return true;
  }
}

class FakeSocket extends EventEmitter {
  public readonly io = new EventEmitter();
  public connected = false;
  public active = false;
  public closeCalls = 0;
  public connectCalls = 0;
  public readonly outboundEvents: Array<{ event: string; args: unknown[] }> = [];

  public connect() {
    this.connectCalls += 1;
    this.active = true;
    return this;
  }

  public close() {
    this.closeCalls += 1;
    this.connected = false;
    this.active = false;
    return this;
  }

  public override emit(event: string, ...args: unknown[]) {
    this.outboundEvents.push({ event, args });
    return true;
  }

  public receive(event: string, ...args: unknown[]) {
    if (event === 'connect') this.connected = true;
    if (event === 'disconnect' || event === 'connect_error') this.connected = false;
    return super.emit(event, ...args);
  }
}

describe('CompanionCommunicationService', () => {
  let children: FakeChildProcess[];
  let sockets: FakeSocket[];
  let service: CompanionCommunicationService;

  const makeService = () =>
    new CompanionCommunicationService(
      cryptoMock,
      '/extension',
      loggerMock,
      pathMock,
      new PathResolverMock('/extension', pathMock, systemMock),
      settingsMock,
    );

  const connectRouter = async (port: number) => {
    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].emit('message', { type: 'ready', port });
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0].receive('connect');
  };

  beforeEach(() => {
    children = [];
    sockets = [];
    systemMock.homedir.mockReturnValue('/home/test');
    systemMock.tmpdir.mockReturnValue('/tmp');

    spawnMock.mockReset();
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      children.push(child);
      return child;
    });

    ioMock.mockReset();
    ioMock.mockImplementation(() => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as Socket;
    });

    service = makeService();
  });

  it('reports startup and connection states when the router becomes ready', async () => {
    const statuses: string[] = [];
    service.signals.on('statusChanged', () => statuses.push(service.getStatus()));

    const connectPromise = service.connect();
    await connectRouter(settingsMock.companion.listenPort);
    await connectPromise;

    expect(statuses).toEqual(['STARTING', 'CONNECTING', 'ONLINE']);
    expect(service.getStatus()).toBe('ONLINE');
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledWith(
      `ws://localhost:${settingsMock.companion.listenPort}`,
      expect.objectContaining({
        timeout: 1000,
        reconnection: false,
      }),
    );
  });

  it('does not spawn duplicate routers when connect is requested concurrently', async () => {
    const firstConnect = service.connect();
    const secondConnect = service.connect();

    await connectRouter(settingsMock.companion.listenPort);
    await Promise.all([firstConnect, secondConnect]);

    expect(spawnMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledOnce();
    expect(service.getStatus()).toBe('ONLINE');
  });

  it('surfaces startup errors and leaves the companion in failed state', async () => {
    const statuses: string[] = [];
    service.signals.on('statusChanged', () => statuses.push(service.getStatus()));

    await service.connect();
    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].emit('message', { type: 'startup-error', message: 'Port 27121 is busy.' });
    await vi.waitFor(() => expect(service.getStatus()).toBe('FAILED'));

    expect(statuses).toEqual(['STARTING', 'FAILED']);
    expect(service.getFailureMessage()).toBe('Port 27121 is busy.');
    expect(children[0].killCalls).toEqual(['SIGTERM']);
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('restarts the router when the listen port changes', async () => {
    const connectPromise = service.connect();
    await connectRouter(settingsMock.companion.listenPort);
    await connectPromise;

    const firstChild = children[0];
    const firstSocket = sockets[0];

    settingsMock.companion.listenPort = 27122;

    await vi.waitFor(() => expect(children).toHaveLength(2));
    children[1].emit('message', { type: 'ready', port: 27122 });
    await vi.waitFor(() => expect(sockets).toHaveLength(2));
    sockets[1].receive('connect');
    await vi.waitFor(() => expect(service.getStatus()).toBe('ONLINE'));

    expect(firstChild.killCalls).toEqual(['SIGTERM']);
    expect(firstSocket.closeCalls).toBe(1);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(ioMock).toHaveBeenNthCalledWith(
      2,
      'ws://localhost:27122',
      expect.objectContaining({
        timeout: 1000,
        query: expect.objectContaining({ type: 'vscode' }),
      }),
    );
  });

  it('hot-updates shutdown timeout without restarting an online router', async () => {
    const connectPromise = service.connect();
    await connectRouter(settingsMock.companion.listenPort);
    await connectPromise;

    const socket = sockets[0];

    settingsMock.companion.shutdownTimeout = 20000;

    await vi.waitFor(() =>
      expect(socket.outboundEvents).toContainEqual({
        event: 'updateConfig',
        args: [{ config: { shutdownTimeout: 20000 } satisfies Partial<RouterConfig> }],
      }),
    );
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledOnce();
    expect(children[0].killCalls).toEqual([]);
  });
});

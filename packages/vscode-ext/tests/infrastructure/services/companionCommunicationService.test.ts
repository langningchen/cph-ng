import type { ChildProcess } from 'node:child_process';
import EventEmitter from 'node:events';
import type { C2rMsg, R2cMsg } from '@cph-ng/core';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { mock } from '@t/mock';
import type { ICrypto } from '@v/application/ports/node/ICrypto';
import type { IPath } from '@v/application/ports/node/IPath';
import type { IPathResolver } from '@v/application/ports/services/IPathResolver';
import { CompanionCommunicationService } from '@v/infrastructure/services/companion/companionCommunicationService';
import type { Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';

const mockedModules = vi.hoisted(() => ({
  io: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: mockedModules.spawn,
}));

vi.mock('socket.io-client', () => ({
  io: mockedModules.io,
}));

class FakeStream extends EventEmitter {
  public destroy = vi.fn();
}

class FakeChildProcess extends EventEmitter {
  public stderr = new FakeStream();
  public connected = true;
  public disconnect = vi.fn(() => {
    this.connected = false;
  });
  public unref = vi.fn();
}

class FakeSocket extends EventEmitter {
  public connected = false;
  public connect = vi.fn(() => this);
  public close = vi.fn();
}

const flushAsyncWork = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

describe('CompanionCommunicationService', () => {
  let service: CompanionCommunicationService;
  let cryptoMock: MockProxy<ICrypto> & ICrypto;
  let pathMock: MockProxy<IPath> & IPath;
  let pathResolverMock: MockProxy<IPathResolver> & IPathResolver;

  beforeEach(() => {
    mockedModules.io.mockReset();
    mockedModules.spawn.mockReset();
    settingsMock.reset();
    loggerMock.info.mockClear();
    loggerMock.error.mockClear();

    cryptoMock = mock<ICrypto>();
    cryptoMock.randomUUID.mockReturnValue('client-id' as ReturnType<ICrypto['randomUUID']>);

    pathMock = mock<IPath>();
    pathMock.join.mockReturnValue('/extension/dist/router.cjs');

    pathResolverMock = mock<IPathResolver>();
    pathResolverMock.renderPath.mockReturnValue('/tmp/cph-ng-router.log');

    service = new CompanionCommunicationService(
      cryptoMock,
      '/extension',
      loggerMock,
      pathMock,
      pathResolverMock,
      settingsMock,
    );
  });

  it('waits for the router ready signal before opening the websocket', async () => {
    const child = new FakeChildProcess();
    const socket = new FakeSocket();
    mockedModules.spawn.mockReturnValue(child as unknown as ChildProcess);
    mockedModules.io.mockReturnValue(socket as unknown as Socket<R2cMsg, C2rMsg>);

    service.connect();

    expect(service.getStatus()).toBe('STARTING');
    expect(mockedModules.io).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith('Launching router process...');
    expect(loggerMock.info).toHaveBeenCalledWith(
      `Router launch requested on port ${settingsMock.companion.listenPort}`,
    );

    child.emit('message', { type: 'ready', port: settingsMock.companion.listenPort });
    await flushAsyncWork();

    expect(mockedModules.io).toHaveBeenCalledWith(
      `ws://localhost:${settingsMock.companion.listenPort}`,
      expect.objectContaining({
        path: '/ws',
        transports: ['websocket'],
      }),
    );
    expect(socket.connect).toHaveBeenCalled();
    expect(child.disconnect).toHaveBeenCalled();
    expect(child.unref).toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      `Router ready on port ${settingsMock.companion.listenPort}`,
    );
    expect(service.getStatus()).toBe('CONNECTING');

    socket.connected = true;
    socket.emit('connect');
    expect(service.getStatus()).toBe('ONLINE');
  });

  it('surfaces startup-error messages as a failed status', async () => {
    const child = new FakeChildProcess();
    mockedModules.spawn.mockReturnValue(child as unknown as ChildProcess);

    service.connect();
    child.emit('message', { type: 'startup-error', message: 'Invalid timeout' });
    await flushAsyncWork();

    expect(service.getStatus()).toBe('FAILED');
    expect(service.getStatusDetail()).toBe('Invalid timeout');
    expect(mockedModules.io).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith('Router launch failed', {
      message: 'Invalid timeout',
    });
  });

  it('includes early stderr output when the router exits before ready', async () => {
    const child = new FakeChildProcess();
    mockedModules.spawn.mockReturnValue(child as unknown as ChildProcess);

    service.connect();
    child.stderr.emit('data', 'EADDRINUSE');
    child.emit('exit', 1, null);
    await flushAsyncWork();

    expect(service.getStatus()).toBe('FAILED');
    expect(service.getStatusDetail()).toContain('EADDRINUSE');
    expect(mockedModules.io).not.toHaveBeenCalled();
  });

  it('does not spawn a second router while startup is already in progress', () => {
    const child = new FakeChildProcess();
    mockedModules.spawn.mockReturnValue(child as unknown as ChildProcess);

    service.connect();
    service.connect();

    expect(service.getStatus()).toBe('STARTING');
    expect(mockedModules.spawn).toHaveBeenCalledTimes(1);
  });

  it('can retry websocket connection after a connect_error failure', async () => {
    const child = new FakeChildProcess();
    const socket = new FakeSocket();
    mockedModules.spawn.mockReturnValue(child as unknown as ChildProcess);
    mockedModules.io.mockReturnValue(socket as unknown as Socket<R2cMsg, C2rMsg>);

    service.connect();
    child.emit('message', { type: 'ready', port: settingsMock.companion.listenPort });
    await flushAsyncWork();

    socket.emit('connect_error', new Error('ECONNREFUSED'));
    expect(service.getStatus()).toBe('FAILED');

    service.connect();

    expect(mockedModules.spawn).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    expect(service.getStatus()).toBe('CONNECTING');
  });
});

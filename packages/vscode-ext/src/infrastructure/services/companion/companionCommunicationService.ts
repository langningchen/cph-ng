// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { type ChildProcess, spawn } from 'node:child_process';
import EventEmitter from 'node:events';
import type {
  BatchId,
  C2rMsg,
  ClientId,
  CompanionProblem,
  R2cMsg,
  RouterConfig,
  SubmitData,
} from '@cph-ng/core';
import type { ICrypto } from '@v/application/ports/node/ICrypto';
import type { IPath } from '@v/application/ports/node/IPath';
import type { IPathResolver } from '@v/application/ports/services/IPathResolver';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ISettings, Unsubscribe } from '@v/application/ports/vscode/ISettings';
import { TOKENS } from '@v/composition/tokens';
import { io, type Socket } from 'socket.io-client';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';

type RouterProcessMessage =
  | { type: 'ready'; port: number }
  | { type: 'startup-error'; message: string };

type RouterLaunchConfig = {
  logFile: string;
  port: number;
  shutdownTimeout: number;
};

type CompanionCommunicationEvents = {
  statusChanged: () => void;
  readingBatch: (batchId: BatchId, count: number, size: number) => void;
  batchAvailable: (batchId: BatchId, problems: CompanionProblem[], autoImport: boolean) => void;
  batchClaimed: (batchId: BatchId) => void;
};

export type RouterStatus = 'OFFLINE' | 'STARTING' | 'CONNECTING' | 'ONLINE' | 'FAILED';

const ROUTER_STARTUP_TIMEOUT_MS = 5000;
const ROUTER_CONNECT_TIMEOUT_MS = 1000;
const ROUTER_STOP_TIMEOUT_MS = 3000;

@injectable()
export class CompanionCommunicationService {
  private clientId: ClientId;
  private routerLogger: ILogger;
  private ws: Socket<R2cMsg, C2rMsg> | undefined;
  private routerProcess: ChildProcess | undefined;
  private status: RouterStatus = 'OFFLINE';
  private failureMessage: string | undefined;
  private startupPromise: Promise<void> | undefined;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private routerReady = false;
  private isStoppingRouter = false;
  private settingsUnsubscribers: Unsubscribe[];
  private _isBrowserConnected = false;
  public readonly signals = new EventEmitter() as TypedEventEmitter<CompanionCommunicationEvents>;

  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly pathResolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
  ) {
    this.clientId = this.crypto.randomUUID() as ClientId;
    this.logger = this.logger.withScope('companionCommunication');
    this.routerLogger = this.logger.withScope('companionRouter');
    this.settingsUnsubscribers = [
      this.settings.companion.onChangeListenPort(() => {
        void this.enqueueLifecycleTask(async () => {
          await this.handleCriticalConfigChange('listenPort');
        });
      }),
      this.settings.companion.onChangeLogFile(() => {
        void this.enqueueLifecycleTask(async () => {
          await this.handleCriticalConfigChange('logFile');
        });
      }),
      this.settings.companion.onChangeShutdownTimeout((shutdownTimeout) => {
        void this.enqueueLifecycleTask(async () => {
          await this.handleShutdownTimeoutChange(shutdownTimeout);
        });
      }),
    ];
  }

  public async connect() {
    await this.enqueueLifecycleTask(async () => {
      try {
        await this.ensureRouterReady();
        await this.ensureSocketConnected();
      } catch (error) {
        await this.handleConnectionFailure(error);
      }
    });
  }

  public async disconnect() {
    for (const unsubscribe of this.settingsUnsubscribers) unsubscribe();
    this.settingsUnsubscribers = [];
    await this.enqueueLifecycleTask(async () => {
      this.clearFailure();
      this.disposeSocket();
      await this.stopRouterProcess('Extension disconnected');
      this.updateStatus('OFFLINE');
    });
  }

  public getStatus(): RouterStatus {
    return this.status;
  }

  public getFailureMessage(): string | undefined {
    return this.failureMessage;
  }

  public cancelBatch(batchId: BatchId) {
    this.ws?.emit('cancelBatch', { batchId });
  }

  public claimBatch(batchId: BatchId) {
    this.ws?.emit('claimBatch', { batchId });
  }

  public submit(data: SubmitData) {
    this.ws?.emit('submit', data);
  }

  public updateConfig(config: Partial<RouterConfig>) {
    this.ws?.emit('updateConfig', { config });
  }

  public isBrowserConnected(): boolean {
    return this._isBrowserConnected;
  }

  private enqueueLifecycleTask<T>(task: () => Promise<T>): Promise<T> {
    const nextTask = this.lifecycleQueue.then(task, task);
    this.lifecycleQueue = nextTask.then(
      () => undefined,
      () => undefined,
    );
    return nextTask;
  }

  private updateStatus(status: RouterStatus, failureMessage?: string) {
    const nextFailureMessage = status === 'FAILED' ? failureMessage : undefined;
    const hasChanged = this.status !== status || this.failureMessage !== nextFailureMessage;
    this.status = status;
    this.failureMessage = nextFailureMessage;
    if (hasChanged) this.signals.emit('statusChanged');
  }

  private clearFailure() {
    if (this.status === 'FAILED') this.updateStatus('OFFLINE');
    else this.failureMessage = undefined;
  }

  private buildLaunchConfig(): RouterLaunchConfig {
    const port = this.settings.companion.listenPort;
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error(`Companion listen port must be between 1 and 65535. Received ${port}.`);

    const shutdownTimeout = this.settings.companion.shutdownTimeout;
    if (!Number.isInteger(shutdownTimeout) || shutdownTimeout <= 0)
      throw new Error(
        `Companion shutdown timeout must be greater than 0. Received ${shutdownTimeout}.`,
      );

    return {
      port,
      shutdownTimeout,
      logFile: this.pathResolver.renderPath(this.settings.companion.logFile),
    };
  }

  private async ensureRouterReady() {
    if (this.routerProcess && this.routerReady) return;
    if (this.startupPromise) return await this.startupPromise;

    const launchConfig = this.buildLaunchConfig();
    this.startupPromise = this.launchRouterProcess(launchConfig);
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = undefined;
    }
  }

  private launchRouterProcess(launchConfig: RouterLaunchConfig): Promise<void> {
    this.logger.info('Router launch requested', launchConfig);
    this.updateStatus('STARTING');

    const routerPath = this.path.join(this.extPath, 'dist', 'router.cjs');
    const child = spawn(
      process.execPath,
      [
        routerPath,
        '-p',
        launchConfig.port.toString(),
        '-l',
        launchConfig.logFile,
        '-s',
        launchConfig.shutdownTimeout.toString(),
      ],
      {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      },
    );

    this.routerProcess = child;
    this.routerReady = false;
    this._isBrowserConnected = false;

    let startupStderr = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      const message = chunk.trim();
      if (message) this.routerLogger.debug(message);
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      startupStderr = `${startupStderr}${chunk}`.slice(-4000);
      const message = chunk.trim();
      if (message) this.routerLogger.error(message);
    });

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for router readiness on port ${launchConfig.port}.`));
      }, ROUTER_STARTUP_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeoutId);
        child.removeListener('error', handleError);
        child.removeListener('exit', handleExit);
        child.removeListener('message', handleMessage);
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        const stderrSuffix = startupStderr.trim() ? ` ${startupStderr.trim()}` : '';
        reject(
          new Error(
            `Router exited before becoming ready (code: ${code ?? 'null'}, signal: ${signal ?? 'null'}).${stderrSuffix}`,
          ),
        );
      };

      const handleMessage = (message: unknown) => {
        if (!this.isRouterProcessMessage(message)) return;
        cleanup();
        if (message.type === 'startup-error') {
          reject(new Error(message.message));
          return;
        }
        this.routerReady = true;
        this.attachRuntimeProcessHandlers(child);
        this.logger.info(`Router ready on port ${message.port}`);
        resolve();
      };

      child.once('error', handleError);
      child.once('exit', handleExit);
      child.on('message', handleMessage);
    });
  }

  private attachRuntimeProcessHandlers(child: ChildProcess) {
    child.on('error', (error) => {
      if (child !== this.routerProcess || this.isStoppingRouter) return;
      this.logger.error('Router process emitted an error', error);
    });
    child.on('exit', (code, signal) => {
      if (child !== this.routerProcess) return;
      this.routerProcess = undefined;
      this.routerReady = false;
      this._isBrowserConnected = false;
      this.disposeSocket();

      if (this.isStoppingRouter) {
        this.logger.info('Router process stopped', { code, signal });
        this.updateStatus('OFFLINE');
        return;
      }

      const message = `Router exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'null'}).`;
      this.logger.error(message);
      this.updateStatus('FAILED', message);
    });
  }

  private async ensureSocketConnected() {
    if (this.ws?.connected) {
      this.updateStatus('ONLINE');
      return;
    }

    this.disposeSocket();
    const port = this.buildLaunchConfig().port;
    const socket = io(`ws://localhost:${port}`, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
      forceNew: true,
      timeout: ROUTER_CONNECT_TIMEOUT_MS,
      query: { clientId: this.clientId, type: 'vscode' },
    });
    this.ws = socket;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
      };

      const handleConnect = () => {
        cleanup();
        this.bindSocketEvents(socket);
        this.updateStatus('ONLINE');
        resolve();
      };

      const handleConnectError = (error: Error) => {
        cleanup();
        reject(error);
      };

      this.updateStatus('CONNECTING');
      socket.once('connect', handleConnect);
      socket.once('connect_error', handleConnectError);
      socket.connect();
    });
  }

  private bindSocketEvents(socket: Socket<R2cMsg, C2rMsg>) {
    socket.on('disconnect', (reason) => {
      if (socket !== this.ws) return;
      this.disposeSocket();
      if (this.isStoppingRouter) return;
      const message = this.routerProcess
        ? `Router connection closed unexpectedly: ${reason}`
        : 'Router is offline.';
      this.logger.error(message);
      this.updateStatus('FAILED', message);
    });
    socket.on('log', ({ level, message, details }) => {
      if (socket !== this.ws) return;
      this.routerLogger[level](message, details);
    });
    socket.on('readingBatch', (msg) => {
      if (socket !== this.ws) return;
      this.logger.trace(`Received readingBatch message`, {
        batchId: msg.batchId,
        count: msg.count,
        size: msg.size,
      });
      this.signals.emit('readingBatch', msg.batchId, msg.count, msg.size);
    });
    socket.on('batchAvailable', (msg) => {
      if (socket !== this.ws) return;
      this.logger.trace(`Received batchAvailable message`, {
        batchId: msg.batchId,
        problemsCount: msg.problems.length,
        autoImport: msg.autoImport,
      });
      this.signals.emit('batchAvailable', msg.batchId, msg.problems, msg.autoImport);
    });
    socket.on('batchClaimed', (msg) => {
      if (socket !== this.ws) return;
      this.logger.trace(`Received batchClaimed message`, { batchId: msg.batchId });
      this.signals.emit('batchClaimed', msg.batchId);
    });
    socket.on('browserStatus', (msg) => {
      if (socket !== this.ws) return;
      this.logger.trace(`Received browserStatus message`, { connected: msg.connected });
      this._isBrowserConnected = msg.connected;
    });
  }

  private disposeSocket() {
    if (!this.ws) return;
    this.ws.removeAllListeners();
    this.ws.close();
    this.ws = undefined;
    this._isBrowserConnected = false;
  }

  private async stopRouterProcess(reason: string) {
    const child = this.routerProcess;
    this.routerProcess = undefined;
    this.routerReady = false;
    if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) return;

    this.logger.info('Stopping router process', { pid: child.pid, reason });
    this.isStoppingRouter = true;
    try {
      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          child.kill('SIGKILL');
        }, ROUTER_STOP_TIMEOUT_MS);

        child.once('exit', () => {
          clearTimeout(timeoutId);
          resolve();
        });
        child.kill('SIGTERM');
      });
    } finally {
      this.isStoppingRouter = false;
    }
  }

  private async handleConnectionFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error('Companion connection failed', error);
    this.disposeSocket();
    await this.stopRouterProcess('Companion connection failed');
    this.updateStatus('FAILED', message);
  }

  private async restartRouter(reason: string) {
    this.logger.info('Restarting router', { reason });
    this.disposeSocket();
    await this.stopRouterProcess(reason);
    try {
      await this.ensureRouterReady();
      await this.ensureSocketConnected();
    } catch (error) {
      await this.handleConnectionFailure(error);
    }
  }

  private async handleCriticalConfigChange(setting: 'listenPort' | 'logFile') {
    if (!this.routerProcess && this.status === 'OFFLINE' && !this.startupPromise) return;
    await this.restartRouter(`Companion ${setting} changed`);
  }

  private async handleShutdownTimeoutChange(shutdownTimeout: number) {
    if (!Number.isInteger(shutdownTimeout) || shutdownTimeout <= 0) {
      await this.handleConnectionFailure(
        new Error(
          `Companion shutdown timeout must be greater than 0. Received ${shutdownTimeout}.`,
        ),
      );
      return;
    }

    if (this.status === 'ONLINE' && this.ws?.connected) {
      this.logger.info('Applying shutdown timeout update', { shutdownTimeout });
      this.updateConfig({ shutdownTimeout });
      return;
    }

    if (this.routerProcess || this.startupPromise) {
      await this.restartRouter('Companion shutdown timeout changed');
    }
  }

  private isRouterProcessMessage(message: unknown): message is RouterProcessMessage {
    if (!message || typeof message !== 'object') return false;
    const type = (message as { type?: unknown }).type;
    if (type === 'ready') return typeof (message as { port?: unknown }).port === 'number';
    if (type === 'startup-error')
      return typeof (message as { message?: unknown }).message === 'string';
    return false;
  }
}

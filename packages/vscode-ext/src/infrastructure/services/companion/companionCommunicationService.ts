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
const ROUTER_CONNECT_RETRY_DELAY_MS = 200;
const ROUTER_RECONNECT_INITIAL_DELAY_MS = 1000;
const ROUTER_RECONNECT_MAX_DELAY_MS = 10000;

@injectable()
export class CompanionCommunicationService {
  private clientId: ClientId;
  private routerLogger: ILogger;
  private ws: Socket<R2cMsg, C2rMsg> | undefined;
  private wsPort: number | undefined;
  private startupProcess: ChildProcess | undefined;
  private status: RouterStatus = 'OFFLINE';
  private failureMessage: string | undefined;
  private startupPromise: Promise<void> | undefined;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectDelayMs = ROUTER_RECONNECT_INITIAL_DELAY_MS;
  private shouldMaintainConnection = false;
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
    this.shouldMaintainConnection = true;
    await this.enqueueLifecycleTask(async () => {
      try {
        await this.connectToRouter();
      } catch (error) {
        await this.handleConnectionFailure(error);
      }
    });
  }

  public async disconnect() {
    this.shouldMaintainConnection = false;
    this.clearReconnectTimer();
    for (const unsubscribe of this.settingsUnsubscribers) unsubscribe();
    this.settingsUnsubscribers = [];
    await this.enqueueLifecycleTask(async () => {
      this.clearFailure();
      this.disposeSocket();
      this.releaseStartupProcessOwnership('Extension disconnected');
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

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  private getListenPort(): number {
    const port = this.settings.companion.listenPort;
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error(`Companion listen port must be between 1 and 65535. Received ${port}.`);
    return port;
  }

  private buildLaunchConfig(): RouterLaunchConfig {
    const port = this.getListenPort();
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
    if (this.startupPromise) return await this.startupPromise;

    const launchConfig = this.buildLaunchConfig();
    this.startupPromise = this.launchRouterProcess(launchConfig);
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = undefined;
    }
  }

  private async connectToRouter() {
    const port = this.getListenPort();
    if (this.ws?.connected && this.wsPort === port) {
      this.clearReconnectTimer();
      this.reconnectDelayMs = ROUTER_RECONNECT_INITIAL_DELAY_MS;
      this.updateStatus('ONLINE');
      return;
    }

    this.clearFailure();

    if (this.startupPromise) {
      await this.ensureRouterReady();
      await this.waitForRouterConnection(port, ROUTER_STARTUP_TIMEOUT_MS);
      return;
    }

    try {
      await this.ensureSocketConnected(port);
      this.logger.info('Connected to existing router', { port });
      return;
    } catch (error) {
      this.disposeSocket();
      this.logger.debug('Unable to connect to existing router, attempting launch', {
        message: error instanceof Error ? error.message : String(error),
        port,
      });
    }

    try {
      await this.ensureRouterReady();
    } catch (error) {
      if (!this.canRetryExistingRouterConnection(error)) throw error;
      this.logger.warn('Router launch conflicted with an existing instance, retrying connection', {
        message: error instanceof Error ? error.message : String(error),
        port,
      });
    }

    await this.waitForRouterConnection(port, ROUTER_STARTUP_TIMEOUT_MS);
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
        detached: true,
        env: process.env,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      },
    );
    child.unref();

    this.startupProcess = child;
    this._isBrowserConnected = false;

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        void this.terminateStartupProcess(
          child,
          `Timed out waiting for router readiness on port ${launchConfig.port}`,
        );
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
        this.clearStartupProcess(child);
        reject(error);
      };

      const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        this.clearStartupProcess(child);
        reject(
          new Error(
            `Router exited before becoming ready (code: ${code ?? 'null'}, signal: ${signal ?? 'null'}).`,
          ),
        );
      };

      const handleMessage = (message: unknown) => {
        if (!this.isRouterProcessMessage(message)) return;
        cleanup();
        if (message.type === 'startup-error') {
          this.releaseStartupProcessOwnership('Router startup failed', child);
          reject(new Error(message.message));
          return;
        }
        this.releaseStartupProcessOwnership('Router ready', child);
        this.logger.info(`Router ready on port ${message.port}`);
        resolve();
      };

      child.once('error', handleError);
      child.once('exit', handleExit);
      child.on('message', handleMessage);
    });
  }

  private async waitForRouterConnection(port: number, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (true) {
      try {
        await this.ensureSocketConnected(port);
        return;
      } catch (error) {
        lastError = error;
        this.disposeSocket();
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      await this.delay(Math.min(ROUTER_CONNECT_RETRY_DELAY_MS, remainingMs));
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to connect to router on port ${port}.`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async ensureSocketConnected(port: number) {
    if (this.ws?.connected && this.wsPort === port) {
      this.updateStatus('ONLINE');
      return;
    }

    this.disposeSocket();
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
    this.wsPort = port;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
      };

      const handleConnect = () => {
        cleanup();
        this.clearReconnectTimer();
        this.reconnectDelayMs = ROUTER_RECONNECT_INITIAL_DELAY_MS;
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
      const message = `Router connection closed unexpectedly: ${reason}`;
      this.logger.error(message);
      this.updateStatus('FAILED', message);
      this.scheduleReconnect(message);
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
    this.wsPort = undefined;
    this._isBrowserConnected = false;
  }

  private clearStartupProcess(child: ChildProcess) {
    if (this.startupProcess !== child) return;
    this.startupProcess = undefined;
  }

  private releaseStartupProcessOwnership(reason: string, child = this.startupProcess) {
    if (!child) return;
    this.clearStartupProcess(child);
    this.logger.info('Releasing router launch process ownership', { pid: child.pid, reason });
    child.removeAllListeners();
    if (child.connected) {
      try {
        child.disconnect();
      } catch {}
    }
    child.unref();
  }

  private terminateStartupProcess(child: ChildProcess, reason: string) {
    this.clearStartupProcess(child);
    if (child.killed || child.exitCode !== null || child.signalCode !== null) return;

    this.logger.warn('Terminating router launch process', { pid: child.pid, reason });
    child.removeAllListeners();
    child.kill('SIGTERM');
  }

  private async handleConnectionFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error('Companion connection failed', error);
    this.disposeSocket();
    this.updateStatus('FAILED', message);
    this.scheduleReconnect(message);
  }

  private async handleCriticalConfigChange(setting: 'listenPort' | 'logFile') {
    if (this.status === 'ONLINE' && this.ws?.connected) {
      const config =
        setting === 'listenPort'
          ? ({ port: this.settings.companion.listenPort } satisfies Partial<RouterConfig>)
          : ({
              logFile: this.pathResolver.renderPath(this.settings.companion.logFile),
            } satisfies Partial<RouterConfig>);
      this.logger.info('Applying critical companion config update', { setting, config });
      this.updateConfig(config);
      return;
    }
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

  private canRetryExistingRouterConnection(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Lock file is already being held') ||
      message.includes('EADDRINUSE') ||
      message.includes('address already in use')
    );
  }

  private scheduleReconnect(reason: string) {
    if (!this.shouldMaintainConnection || this.reconnectTimer) return;
    if (!this.shouldAutoReconnect(reason)) return;

    const delayMs = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, ROUTER_RECONNECT_MAX_DELAY_MS);
    this.logger.info('Scheduling router reconnect', { delayMs, reason });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, delayMs);
  }

  private shouldAutoReconnect(message: string): boolean {
    return !(
      message.includes('Companion listen port must be between') ||
      message.includes('Companion shutdown timeout must be greater than 0')
    );
  }
}

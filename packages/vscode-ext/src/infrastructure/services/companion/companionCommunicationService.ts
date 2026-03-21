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
import type { ISettings } from '@v/application/ports/vscode/ISettings';
import { TOKENS } from '@v/composition/tokens';
import { io, type Socket } from 'socket.io-client';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';

type CompanionCommunicationEvents = {
  statusChanged: () => void;
  readingBatch: (batchId: BatchId, count: number, size: number) => void;
  batchAvailable: (batchId: BatchId, problems: CompanionProblem[], autoImport: boolean) => void;
  batchClaimed: (batchId: BatchId) => void;
};

type RouterStartupMessage =
  | { type: 'ready'; port: number }
  | { type: 'startup-error'; message: string };

const ROUTER_STARTUP_TIMEOUT_MS = 5000;
const MAX_STARTUP_STDERR_LENGTH = 4096;

const isReadyMessage = (message: unknown): message is { type: 'ready'; port: number } => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'ready' &&
    'port' in message &&
    typeof message.port === 'number'
  );
};

const isStartupErrorMessage = (
  message: unknown,
): message is { type: 'startup-error'; message: string } => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'startup-error' &&
    'message' in message &&
    typeof message.message === 'string'
  );
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export type RouterStatus = 'OFFLINE' | 'STARTING' | 'CONNECTING' | 'ONLINE' | 'FAILED';

@injectable()
export class CompanionCommunicationService {
  private clientId: ClientId;
  private routerLogger: ILogger;
  private ws: Socket<R2cMsg, C2rMsg> | undefined;
  private _isBrowserConnected = false;
  private status: RouterStatus = 'OFFLINE';
  private statusDetail: string | undefined;
  private isDisconnecting = false;
  private startupPromise: Promise<void> | undefined;
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
  }

  public connect() {
    if (this.startupPromise) {
      this.logger.debug('Router startup already in progress');
      return;
    }

    if (this.ws) {
      this.connectSocket();
      return;
    }

    this.setStatus('STARTING');
    this.startupPromise = this.launchRouter()
      .then(() => {
        this.startupPromise = undefined;
        this.createSocket();
        this.connectSocket();
      })
      .catch((error) => {
        this.startupPromise = undefined;
        this.setStatus('FAILED', formatError(error));
      });
  }

  public disconnect() {
    this.isDisconnecting = true;
    this.startupPromise = undefined;
    this.ws?.close();
    this.ws = undefined;
    this._isBrowserConnected = false;
    this.setStatus('OFFLINE');
    this.isDisconnecting = false;
  }

  public getStatus(): RouterStatus {
    return this.status;
  }

  public getStatusDetail(): string | undefined {
    return this.statusDetail;
  }

  private setStatus(status: RouterStatus, detail?: string) {
    const nextDetail = detail?.trim() || undefined;
    if (this.status === status && this.statusDetail === nextDetail) return;
    this.status = status;
    this.statusDetail = nextDetail;
    this.signals.emit('statusChanged');
  }

  private launchRouter() {
    this.logger.info('Launching router process...');
    const node = process.execPath;
    const routerPath = this.path.join(this.extPath, 'dist', 'router.cjs');
    const port = this.settings.companion.listenPort.toString();
    const logFile = this.pathResolver.renderPath(this.settings.companion.logFile);
    const shutdownTimeout = this.settings.companion.shutdownTimeout.toString();

    this.logger.debug('Router launch parameters', {
      node,
      routerPath,
      port,
      logFile,
      shutdownTimeout,
    });
    const childProcess = spawn(
      node,
      [routerPath, '-p', port, '-l', logFile, '-s', shutdownTimeout],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: process.env,
      },
    );
    this.logger.info(`Router launch requested on port ${port}`);

    return this.waitForRouterReady(childProcess)
      .then(() => {
        this.logger.info(`Router ready on port ${port}`);
      })
      .catch((error) => {
        this.logger.error('Router launch failed', { message: formatError(error) });
        throw error;
      });
  }

  private waitForRouterReady(childProcess: ChildProcess) {
    return new Promise<void>((resolve, reject) => {
      let stderrOutput = '';
      let settled = false;

      const stderr = childProcess.stderr;
      const onStderr = (chunk: Buffer | string) => {
        stderrOutput = `${stderrOutput}${chunk.toString()}`;
        if (stderrOutput.length > MAX_STARTUP_STDERR_LENGTH)
          stderrOutput = stderrOutput.slice(-MAX_STARTUP_STDERR_LENGTH);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        childProcess.off('message', onMessage);
        childProcess.off('error', onError);
        childProcess.off('exit', onExit);
        stderr?.off('data', onStderr);
      };

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const withStderr = (message: string) => {
        const detail = stderrOutput.trim();
        if (!detail) return message;
        return `${message}: ${detail}`;
      };

      const onMessage = (message: unknown) => {
        if (isReadyMessage(message)) {
          settle(() => {
            if (childProcess.connected) childProcess.disconnect();
            stderr?.destroy();
            childProcess.unref();
            resolve();
          });
          return;
        }
        if (isStartupErrorMessage(message)) {
          settle(() => reject(new Error(message.message)));
        }
      };

      const onError = (error: Error) => {
        settle(() => reject(error));
      };

      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        settle(() =>
          reject(
            new Error(
              withStderr(
                `Router exited before becoming ready (code: ${code ?? 'null'}, signal: ${signal ?? 'null'})`,
              ),
            ),
          ),
        );
      };

      const timeout = setTimeout(() => {
        settle(() =>
          reject(
            new Error(
              withStderr(`Router did not become ready within ${ROUTER_STARTUP_TIMEOUT_MS}ms`),
            ),
          ),
        );
      }, ROUTER_STARTUP_TIMEOUT_MS);

      childProcess.on('message', onMessage as (message: RouterStartupMessage) => void);
      childProcess.once('error', onError);
      childProcess.once('exit', onExit);
      stderr?.on('data', onStderr);
    });
  }

  private createSocket() {
    if (this.ws) return;
    const port = this.settings.companion.listenPort;
    this.ws = io(`ws://localhost:${port}`, {
      path: '/ws',
      transports: ['websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 1000,
      autoConnect: false,
      query: { clientId: this.clientId, type: 'vscode' },
    });
    this.bindEvents();
  }

  private connectSocket() {
    this.createSocket();
    if (!this.ws) return;
    this.setStatus('CONNECTING');
    this.ws.connect();
  }

  private bindEvents() {
    if (!this.ws) return;
    this.ws.on('connect', () => {
      this.setStatus('ONLINE');
    });
    this.ws.on('connect_error', (error) => {
      this.logger.error('Failed to connect to router', { message: error.message });
      this.setStatus('FAILED', error.message);
    });
    this.ws.on('disconnect', () => {
      this._isBrowserConnected = false;
      if (this.isDisconnecting) return;
      this.setStatus('CONNECTING');
    });
    this.ws.on('log', ({ level, message, details }) => {
      this.routerLogger[level](message, details);
    });
    this.ws.on('readingBatch', (msg) => {
      this.logger.trace(`Received readingBatch message`, {
        batchId: msg.batchId,
        count: msg.count,
        size: msg.size,
      });
      this.signals.emit('readingBatch', msg.batchId, msg.count, msg.size);
    });
    this.ws.on('batchAvailable', (msg) => {
      this.logger.trace(`Received batchAvailable message`, {
        batchId: msg.batchId,
        problemsCount: msg.problems.length,
        autoImport: msg.autoImport,
      });
      this.signals.emit('batchAvailable', msg.batchId, msg.problems, msg.autoImport);
    });
    this.ws.on('batchClaimed', (msg) => {
      this.logger.trace(`Received batchClaimed message`, { batchId: msg.batchId });
      this.signals.emit('batchClaimed', msg.batchId);
    });
    this.ws.on('browserStatus', (msg) => {
      this.logger.trace(`Received browserStatus message`, { connected: msg.connected });
      this._isBrowserConnected = msg.connected;
    });
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
}

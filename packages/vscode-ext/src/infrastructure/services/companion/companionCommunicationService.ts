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

import { spawn } from 'node:child_process';
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
import { io, type Socket } from 'socket.io-client';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IPath } from '@/application/ports/node/IPath';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';

type CompanionCommunicationEvents = {
  statusChanged: () => void;
  readingBatch: (batchId: BatchId, count: number, size: number) => void;
  batchAvailable: (batchId: BatchId, problems: CompanionProblem[], autoImport: boolean) => void;
  batchClaimed: (batchId: BatchId) => void;
};

export type RouterStatus = 'OFFLINE' | 'CONNECTING' | 'ONLINE';

@injectable()
export class CompanionCommunicationService {
  private clientId: ClientId;
  private routerLogger: ILogger;
  private ws: Socket<R2cMsg, C2rMsg> | undefined;
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
  }

  public spawnRouter() {
    this.logger.info('Spawning router process...');
    const node = process.execPath;
    const routerPath = this.path.join(this.extPath, 'dist', 'router.cjs');
    const port = this.settings.companion.listenPort.toString();
    const logFile = this.pathResolver.renderPath(this.settings.companion.logFile);
    const shutdownTimeout = this.settings.companion.shutdownTimeout.toString();

    this.logger.debug('Router spawn parameters', {
      node,
      routerPath,
      port,
      logFile,
      shutdownTimeout,
    });
    const childProcess = spawn(
      node,
      [routerPath, '-p', port, '-l', logFile, '-s', shutdownTimeout],
      { detached: true, stdio: 'ignore', env: process.env },
    );
    childProcess.unref();
    this.logger.info(`Router process spawned on port ${port}`);
  }

  public connect() {
    if (this.ws) return;
    this.spawnRouter();
    const port = this.settings.companion.listenPort;
    this.ws = io(`ws://localhost:${port}`, {
      path: '/ws',
      transports: ['websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 1000,
      autoConnect: true,
      query: { clientId: this.clientId, type: 'vscode' },
    });
    this.bindEvents();
  }

  public disconnect() {
    this.ws?.close();
    this.ws = undefined;
  }

  public getStatus(): RouterStatus {
    if (!this.ws) return 'OFFLINE';
    if (this.ws.connected) return 'ONLINE';
    return 'CONNECTING';
  }

  private bindEvents() {
    if (!this.ws) return;
    this.ws.on('connect', () => this.signals.emit('statusChanged'));
    this.ws.on('disconnect', () => this.signals.emit('statusChanged'));
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

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
  CompanionClientMsg,
  CompanionMsg,
  CompanionProblem,
  Config,
  CphSubmitData,
} from '@r/types';
import { WebSocket } from 'partysocket';
import { inject, injectable } from 'tsyringe';
import type { Except } from 'type-fest';
import type TypedEventEmitter from 'typed-emitter';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IPath } from '@/application/ports/node/IPath';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import type { BatchId, ClientId, SubmissionId } from '@/domain/types';

export type CompanionCommunicationEvents = {
  statusChanged: () => void;
  readingBatch: (batchId: BatchId, count: number, size: number) => void;
  batchAvailable: (batchId: BatchId, problems: CompanionProblem[], autoImport: boolean) => void;
  batchClaimed: (batchId: BatchId) => void;
  submissionConsumed: (submissionId: SubmissionId) => void;
};

export type RouterStatus = 'OFFLINE' | 'CONNECTING' | 'ONLINE';

@injectable()
export class CompanionCommunicationService {
  private clientId: ClientId;
  private routerLogger: ILogger;
  private ws: WebSocket | undefined;
  public readonly signals = new EventEmitter() as TypedEventEmitter<CompanionCommunicationEvents>;

  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.pathResolver) private readonly pathResolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
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
      { detached: true, stdio: 'ignore' },
    );
    childProcess.unref();
    this.logger.info(`Router process spawned on port ${port}`);
  }

  public connect() {
    if (this.ws) return;
    this.spawnRouter();
    const port = this.settings.companion.listenPort;
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, [], {
      maxReconnectionDelay: 3000,
      minReconnectionDelay: 500,
      connectionTimeout: 1000,
      debug: true,
      debugLogger: (...args) => this.logger.trace('', ...args),
    });
    this.bindEvents();
  }

  public disconnect() {
    this.ws?.close();
    this.ws = undefined;
  }

  public getStatus(): RouterStatus {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) return 'OFFLINE';
    if (this.ws.readyState === WebSocket.OPEN) return 'ONLINE';
    return 'CONNECTING';
  }

  private send(msg: Except<CompanionClientMsg, 'clientId'>) {
    if (this.getStatus() !== 'ONLINE')
      return this.ui.alert('error', this.translator.t('Companion not connected'));
    this.ws?.send(JSON.stringify({ ...msg, clientId: this.clientId } satisfies CompanionClientMsg));
  }

  private bindEvents() {
    if (!this.ws) return;
    const events = ['open', 'close', 'error'];
    events.forEach((evt) => {
      this.ws?.addEventListener(evt, () => this.signals.emit('statusChanged'));
    });
    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data.toString()) as CompanionMsg;
        if (msg.type === 'log') return this.routerLogger[msg.level](msg.message, msg.details);
        this.logger.trace(`Received message type: ${msg.type}`, { details: msg });
        if (msg.type === 'readingBatch')
          this.signals.emit('readingBatch', msg.batchId, msg.count, msg.size);
        else if (msg.type === 'batchAvailable')
          this.signals.emit('batchAvailable', msg.batchId, msg.problems, msg.autoImport);
        else if (msg.type === 'batchClaimed') this.signals.emit('batchClaimed', msg.batchId);
        else if (msg.type === 'submissionConsumed')
          this.signals.emit('submissionConsumed', msg.submissionId);
      } catch (err) {
        this.logger.debug('Failed to parse companion message', {
          error: err,
          data: event.data.toString(),
        });
      }
    });
  }

  public cancelBatch(batchId: BatchId) {
    this.send({ type: 'cancelBatch', batchId });
  }
  public claimBatch(batchId: BatchId) {
    this.send({ type: 'claimBatch', batchId });
  }
  public submit(data: CphSubmitData) {
    const submissionId = this.crypto.randomUUID() as SubmissionId;
    this.send({ type: 'submit', submissionId, data });
    return submissionId;
  }
  public cancelSubmit(submissionId: SubmissionId) {
    this.send({ type: 'cancelSubmit', submissionId });
  }
  public updateConfig(config: Partial<Config>) {
    this.send({ type: 'updateConfig', config });
  }
}

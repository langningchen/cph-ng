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
import { WebSocket } from 'partysocket';
import { inject, injectable } from 'tsyringe';
import { ProgressLocation, window } from 'vscode';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ICompanion } from '@/application/ports/services/ICompanion';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi, StatusBarController } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';
import type { BatchId, ClientId, SubmissionId } from '@/domain/types';
import type {
  CancelBatchMsg,
  ClaimBatchMsg,
  CompanionMsg,
  CompanionProblem,
  CphSubmitData,
  SubmitMsg,
} from '@/router/types';

@injectable()
export class Companion implements ICompanion {
  private routerLogger: ILogger;
  private ws: WebSocket | undefined;
  private clientId: ClientId;
  private abortControllers: Map<BatchId | SubmissionId, AbortController> = new Map();
  private readingProgress: Map<BatchId, (count: number, size: number) => void> = new Map();
  private statusBarController: StatusBarController;
  private batchesToClaim: Map<BatchId, CompanionProblem[]> = new Map();

  public constructor(
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.pathResolver) private readonly pathResolver: IPathResolver,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.logger) private readonly logger: ILogger,
  ) {
    this.clientId = this.crypto.randomUUID() as ClientId;
    this.routerLogger = this.logger.withScope('router');
    this.logger = this.logger.withScope('companion');
    this.statusBarController = this.ui.showStatusbar('companion', async () =>
      this.handleStatusBarClick(),
    );
  }

  private async handleStatusBarClick() {
    this.logger.debug('Status bar item clicked');
    if (this.ws?.readyState !== WebSocket.OPEN) return this.spawnRouter();
    if (this.batchesToClaim.size === 0) this.logger.info('No batches to claim');
    else if (this.batchesToClaim.size === 1) {
      const batchId = Array.from(this.batchesToClaim.keys())[0];
      this.claimBatch(batchId);
    } else {
      const batchId = await this.ui.quickPick<BatchId>(
        Array.from(this.batchesToClaim.entries()).map(([batchId, problems]) => ({
          label: this.translator.t('{count} problem(s) available', { count: problems.length }),
          description:
            `${problems.reduce((prev, problem) => Math.max(prev, problem.timeLimit), 0)}ms, ` +
            `${problems.reduce((prev, problem) => Math.max(prev, problem.memoryLimit), 0)}MB`,
          detail: problems.map((problem) => problem.name).join(', '),
          value: batchId,
        })),
        { title: this.translator.t('Select a batch to claim') },
      );
      if (batchId) this.claimBatch(batchId);
    }
  }

  private bindEvents() {
    if (!this.ws) return;
    const events = ['open', 'close', 'error'];
    events.forEach((evt) => {
      this.ws?.addEventListener(evt, () => this.updateStatusBar());
    });
    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data.toString()) as CompanionMsg;
        this.handleMessage(msg);
      } catch (err) {
        this.logger.debug('Failed to parse companion message', {
          error: err,
          data: event.data.toString(),
        });
      }
    });
  }

  private updateStatusBar() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      return this.statusBarController.update(
        this.translator.t('CPH-NG: Offline'),
        this.translator.t('Click to reconnect'),
        'error',
      );
    }
    if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.CLOSING) {
      return this.statusBarController.update(
        this.translator.t('CPH-NG: Connecting...'),
        this.translator.t('Attempting to establish connection'),
        'warn',
      );
    }

    if (this.batchesToClaim.size === 0) {
      const text = this.translator.t('CPH-NG Companion');
      const tooltip = this.translator.t('No batches to claim');
      return this.statusBarController.update(text, tooltip, 'normal');
    }

    if (this.batchesToClaim.size === 1) {
      const problems = Array.from(this.batchesToClaim.values())[0];
      const text = this.translator.t('{count} problem(s) available', { count: problems.length });
      const tooltip = problems
        .map(({ interactive, timeLimit, memoryLimit, input, output, name, tests, url }) => {
          const details = [];
          if (interactive) details.push(this.translator.t('interactive'));
          details.push(`${timeLimit}ms`);
          details.push(`${memoryLimit}MB`);
          details.push(this.translator.t('{count} test(s)', { count: tests.length }));
          if (input.fileName)
            details.push(this.translator.t('input: {fileName}', { fileName: input.fileName }));
          if (output.fileName)
            details.push(this.translator.t('output: {fileName}', { fileName: output.fileName }));
          return `- **[${name}](${url})** (${details.join(', ')})`;
        })
        .join('\n');
      return this.statusBarController.update(text, tooltip, 'warn');
    }

    const batches = Array.from(this.batchesToClaim.values());
    const text = this.translator.t('{count} batches to claim', { count: batches.length });
    const tooltip = batches
      .map((problems) => `- **${problems.length} problem(s)** (${problems[0].name}, ...)`)
      .join('\n');
    this.statusBarController.update(text, tooltip, 'warn');
  }

  private spawnRouter() {
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
      minReconnectionDelay: 500 + Math.random() * 100,
      connectionTimeout: 1000,
      debug: true,
      debugLogger: (...args) => this.logger.trace('[WebSocket]', ...args),
    });
    this.bindEvents();
  }

  private handleMessage(msg: CompanionMsg) {
    if (msg.type === 'log') {
      this.routerLogger[msg.level](msg.message, msg.details);
      return;
    }
    this.logger.trace(`Received message type: ${msg.type}`, { details: msg });
    if (msg.type === 'readingBatch') {
      const { batchId, count, size } = msg;
      if (!this.readingProgress.get(batchId)) {
        const controller = this.ui.progress(
          this.translator.t('Reading problems from companion...'),
          this.cancelBatch.bind(this, batchId),
        );
        this.readingProgress.set(batchId, (count, size) => {
          controller.report({ increment: (1 / size) * 100 });
          if (count >= size) {
            controller.done();
            this.readingProgress.delete(batchId);
          }
        });
      }
      this.readingProgress.get(batchId)?.(count, size);
    } else if (msg.type === 'batchAvailable') {
      const { batchId, autoImport, problems } = msg;
      const controller = new AbortController();
      this.abortControllers.set(batchId, controller);
      if (autoImport) {
        this.logger.info('Auto-importing batch', { batchId });
        this.claimBatch(batchId);
      } else {
        this.batchesToClaim.set(batchId, problems);
        controller.signal.addEventListener('abort', () => {
          this.removeBatch(batchId);
        });
        this.updateStatusBar();
      }
    } else if (msg.type === 'batchClaimed') {
      const { batchId } = msg;
      this.logger.info('Batch claimed', { batchId });
      const controller = this.abortControllers.get(batchId);
      if (controller) controller.abort();
      this.updateStatusBar();
    } else if (msg.type === 'submissionConsumed') {
      const submissionId = msg.submissionId;
      this.logger.info('Submission consumed', { submissionId });
      const controller = this.abortControllers.get(submissionId);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(submissionId);
      }
    }
  }

  private cancelBatch(batchId: BatchId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'cancelBatch',
        batchId,
        clientId: this.clientId,
      } satisfies CancelBatchMsg),
    );
  }
  private removeBatch(batchId: BatchId) {
    this.abortControllers.delete(batchId);
    this.batchesToClaim.delete(batchId);
  }
  private claimBatch(batchId: BatchId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.removeBatch(batchId);
    this.ws.send(
      JSON.stringify({
        type: 'claimBatch',
        clientId: this.clientId,
        batchId,
      } satisfies ClaimBatchMsg),
    );
  }
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
  public async submit(problem: Problem) {
    if (!problem.url) throw new Error(this.translator.t('Problem URL is undefined'));
    const submissionId = this.crypto.randomUUID() as SubmissionId;
    this.logger.info('Submitting problem', { problem, submissionId });

    const data = {
      empty: false,
      problemName: problem.name,
      url: problem.url,
      sourceCode: await this.fs.readFile(problem.src.path),
      languageId: this.settings.companion.submitLanguage,
    } satisfies CphSubmitData;

    return new Promise<void>((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
        throw new Error(this.translator.t('Companion not connected'));

      const controller = new AbortController();
      this.abortControllers.set(submissionId, controller);

      this.ws.send(
        JSON.stringify({
          type: 'submit',
          submissionId,
          clientId: this.clientId,
          data,
        } satisfies SubmitMsg),
      );
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: this.translator.t('Submitting {name}...', { name: problem.name }),
          cancellable: true,
        },
        (_progress, token) => {
          token.onCancellationRequested(() => {
            this.cancelSubmit(submissionId);
            resolve();
          });
          return new Promise<void>((res) => {
            controller.signal.addEventListener('abort', () => {
              res();
              this.abortControllers.delete(submissionId);
            });
          });
        },
      );
    });
  }
  private async cancelSubmit(submissionId: SubmissionId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
      throw new Error(this.translator.t('Companion not connected'));

    this.logger.info(`Cancelling submission ${submissionId}...`);
    this.ws.send(JSON.stringify({ type: 'cancelSubmit', submissionId, clientId: this.clientId }));
  }
}

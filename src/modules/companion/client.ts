import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';
import { l10n, ProgressLocation, window } from 'vscode';
import WebSocket from 'ws';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { Handler } from './handler';
import { CphSubmitData } from './types';

const WS_URL = 'ws://localhost:27122';

export class CompanionClient {
  private static logger = new Logger('companionClient');
  private static ws: WebSocket | null = null;
  private static reconnectAttempts = 0;
  private static isConnecting = false;
  private static clientId = Math.random().toString(36).substring(7);
  private static eventEmitter = new EventEmitter();

  public static init() {
    this.connect();
  }

  private static async connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    this.isConnecting = true;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t('Connecting to Companion Router...'),
        cancellable: false,
      },
      async (progress) => {
        const maxRetries = 3;
        for (let i = 0; i <= maxRetries; i++) {
          if (i > 0) {
            progress.report({
              message: l10n.t(
                'Connection failed. Retrying... ({attempt}/{max})',
                { attempt: i, max: maxRetries },
              ),
              increment: 100 / (maxRetries + 1),
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await this.spawnRouter();
          }

          const success = await this.attemptConnection();
          if (success) {
            this.isConnecting = false;
            return;
          }
        }

        this.isConnecting = false;
        Io.error(
          l10n.t(
            'Failed to connect to Companion Router after multiple attempts.',
          ),
        );
      },
    );
  }

  private static attemptConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);

      const onOpen = () => {
        cleanup();
        this.ws = ws;
        this.setupListeners(ws);
        resolve(true);
      };

      const onError = (err: Error) => {
        this.logger.warn('WebSocket connection error', err);
        cleanup();
        resolve(false);
      };

      const onClose = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        ws.removeListener('open', onOpen);
        ws.removeListener('error', onError);
        ws.removeListener('close', onClose);
      };

      ws.on('open', onOpen);
      ws.on('error', onError);
      ws.on('close', onClose);
    });
  }

  private static setupListeners(ws: WebSocket) {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (e) {
        this.logger.error('Failed to parse message', e);
      }
    });

    ws.on('error', (err) => {
      this.logger.warn('WebSocket error', err);
    });

    ws.on('close', () => {
      this.logger.info('Disconnected from Companion Router');
      this.ws = null;
      this.isConnecting = false;
    });
  }

  private static async spawnRouter() {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t('Spawning Companion Router...'),
        cancellable: false,
      },
      async () => {
        this.logger.info('Spawning Companion Router process...');
        const routerScript = join(__dirname, 'router.js');
        const logFile = join(Settings.cache.directory, 'router.log');

        try {
          const child = spawn(process.execPath, [routerScript], {
            detached: true,
            stdio: 'ignore',
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: '1',
              CPH_LOG_FILE: logFile,
            },
          });
          child.unref();
          this.logger.info('Router process spawned');
          // Give it a moment to start
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (e) {
          this.logger.error('Failed to spawn router', e);
        }
      },
    );
  }

  private static handleMessage(msg: any) {
    switch (msg.type) {
      case 'batch-available':
        Handler.handleBatchAvailable(msg.batchId, msg.problems);
        break;
      case 'batch-claimed':
        Handler.handleBatchClaimed(msg.batchId);
        break;
      case 'submission-consumed':
        if (msg.clientId === this.clientId) {
          this.eventEmitter.emit('submission-consumed');
        }
        break;
    }
  }

  public static sendSubmit(data: CphSubmitData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'submit',
          data: {
            ...data,
            clientId: this.clientId,
          },
        }),
      );
      Io.info(l10n.t('Submission sent to queue'));
    } else {
      Io.error(l10n.t('Companion Router not connected'));
    }
  }

  public static waitForSubmissionConsumed(): Promise<void> {
    return new Promise((resolve) => {
      this.eventEmitter.once('submission-consumed', resolve);
    });
  }

  public static claimBatch(batchId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'claim-batch',
          batchId,
          clientId: this.clientId,
        }),
      );
    }
  }
}

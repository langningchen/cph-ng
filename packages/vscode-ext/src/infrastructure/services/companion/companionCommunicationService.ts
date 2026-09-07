import { execFile, spawn } from 'node:child_process';
import EventEmitter from 'node:events';
import { promisify } from 'node:util';
import type { BatchId, CompanionProblem, SubmitData } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';
import { commands, env, window } from 'vscode';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { KernelService } from '@/infrastructure/rpc/kernelService';
import { GatewayClient } from './gatewayClient';

type CompanionCommunicationEvents = {
  statusChanged: () => void;
  readingBatch: (batchId: BatchId, count: number, size: number) => void;
  batchAvailable: (batchId: BatchId, problems: CompanionProblem[], autoImport: boolean) => void;
  batchClaimed: (batchId: BatchId) => void;
};
export type RouterStatus = 'OFFLINE' | 'CONNECTING' | 'ONLINE';
interface Connection {
  port: number;
  token: string;
}
@injectable()
export class CompanionCommunicationService {
  private ws?: GatewayClient;
  private connecting = false;
  private enabled = false;
  private lastSpawn = 0;
  private browserConnected = false;
  public readonly signals = new EventEmitter() as TypedEventEmitter<CompanionCommunicationEvents>;
  public constructor(
    @inject(KernelService) private readonly kernel: KernelService,
    @inject(TOKENS.logger) private readonly logger: ILogger,
  ) {
    this.logger = logger.withScope('companionCommunication');
    this.kernel.addSubscription(
      commands.registerCommand('cph-ng.pairBrowser', async () => {
        const info = await this.connectionInfo();
        await env.clipboard.writeText(info.token);
        await window.showInformationMessage(
          `Browser pairing token copied. Paste it in the CPH-NG browser extension (port ${info.port}).`,
        );
      }),
    );
  }
  private async connectionInfo(): Promise<Connection> {
    const { stdout } = await promisify(execFile)(
      this.kernel.executable(),
      ['config', '--scope', 'router', 'show', '--json', '--store-root', this.kernel.storeRoot],
      { timeout: 10000, maxBuffer: 65536, windowsHide: true },
    );
    const info = JSON.parse(stdout) as Connection;
    if (
      !Number.isInteger(info.port) ||
      info.port < 1 ||
      info.port > 65535 ||
      typeof info.token !== 'string'
    )
      throw new Error('Invalid gateway connection details');
    return info;
  }
  public spawnRouter(): void {
    if (Date.now() - this.lastSpawn < 10000) return;
    this.lastSpawn = Date.now();
    const child = spawn(
      this.kernel.executable(),
      ['router', 'serve', '--store-root', this.kernel.storeRoot],
      { detached: true, stdio: 'ignore', windowsHide: true, shell: false },
    );
    child.on('error', (error) => this.logger.error('Cannot start Rust gateway', error));
    child.unref();
  }
  public connect(): void {
    this.enabled = true;
    if (this.ws || this.connecting) return;
    this.connecting = true;
    void this.connectionInfo()
      .then((info) => {
        if (!this.enabled) return;
        this.spawnRouter();
        const ws = new GatewayClient(info.port, info.token);
        this.ws = ws;
        ws.events.on('reconnecting', () => {
          if (this.enabled && this.ws === ws) this.spawnRouter();
        });
        ws.events.on('connect', () => {
          if (this.ws === ws) this.signals.emit('statusChanged');
        });
        ws.events.on('disconnect', () => {
          if (this.ws !== ws) return;
          this.browserConnected = false;
          this.signals.emit('statusChanged');
        });
        ws.events.on('notification', (method: string, data: Record<string, unknown>) => {
          if (this.ws !== ws) return;
          switch (method) {
            case 'event.router.reading_batch':
              this.signals.emit(
                'readingBatch',
                data.batchId as BatchId,
                Number(data.count),
                Number(data.size),
              );
              break;
            case 'event.router.batch_available':
              this.signals.emit(
                'batchAvailable',
                data.batchId as BatchId,
                data.problems as CompanionProblem[],
                data.autoImport === true,
              );
              break;
            case 'event.router.batch_claimed':
              this.signals.emit('batchClaimed', data.batchId as BatchId);
              break;
            case 'event.router.browser_status':
              this.browserConnected = data.connected === true;
              this.signals.emit('statusChanged');
              break;
          }
        });
        ws.connect();
      })
      .catch((error) => this.logger.error('Cannot connect to Rust gateway', error))
      .finally(() => {
        this.connecting = false;
        this.signals.emit('statusChanged');
      });
  }
  public disconnect(): void {
    this.enabled = false;
    this.ws?.close();
    this.ws = undefined;
    this.browserConnected = false;
    this.signals.emit('statusChanged');
  }
  public getStatus(): RouterStatus {
    return this.ws?.connected ? 'ONLINE' : this.ws || this.connecting ? 'CONNECTING' : 'OFFLINE';
  }
  public cancelBatch(batchId: BatchId): void {
    void this.ws
      ?.request('router.cancel_batch', { batchId })
      .catch((error) => this.logger.error('Cannot cancel batch', error));
  }
  public async claimBatch(batchId: BatchId): Promise<void> {
    if (!this.ws) throw new Error('Gateway is disconnected');
    await this.ws.request('router.claim_batch', { batchId });
  }
  public async completeBatch(batchId: BatchId): Promise<void> {
    if (!this.ws) throw new Error('Gateway is disconnected');
    await this.ws.request('router.complete_batch', { batchId });
  }
  public async submit(data: SubmitData): Promise<void> {
    if (!this.ws) throw new Error('Gateway is disconnected');
    await this.ws.request('router.submit', { ...data });
  }
  public isBrowserConnected(): boolean {
    return this.browserConnected;
  }
}

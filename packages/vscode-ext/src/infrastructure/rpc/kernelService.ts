// biome-ignore-all lint/style/useNamingConvention: JSON-RPC fields follow the Rust wire schema.

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { commands, type ExtensionContext, window, workspace } from 'vscode';
import type { KernelRpcClient } from './client';
import { connectSharedKernel } from './daemon';
import { ProblemPreferences } from './preferences';
import { rpcMethod } from './protocol';

/** Connects editor windows to the shared local judge kernel for this store. */
export class KernelService {
  private client?: KernelRpcClient;
  private roots = new Set<string>();
  private transitioning: Promise<void> = Promise.resolve();
  public readonly storeRoot: string;
  public readonly preferences: ProblemPreferences;
  public constructor(private readonly context: ExtensionContext) {
    this.storeRoot = join(context.globalStorageUri.fsPath, 'judge');
    this.preferences = new ProblemPreferences(context.globalState);
    for (const folder of workspace.workspaceFolders ?? []) this.roots.add(folder.uri.fsPath);
    context.subscriptions.push(
      commands.registerCommand('cph-ng.showJudgeHistory', async () => {
        const source = window.activeTextEditor?.document.uri.fsPath;
        if (!source) return;
        const client = await this.forSource(source);
        const history = await client.request<
          Array<{
            task_id: string;
            state: string;
            created_at: number;
            result?: { verdict?: string };
          }>
        >(rpcMethod.historyList, { source_path: source });
        const selected = await window.showQuickPick(
          history.map((entry) => ({
            label: entry.result?.verdict ?? entry.state,
            description: new Date(entry.created_at).toLocaleString(),
            taskId: entry.task_id,
          })),
          { placeHolder: 'Choose a judge run' },
        );
        if (!selected) return;
        const entry = await client.request(rpcMethod.historyLoad, {
          run_id: selected.taskId,
        });
        const document = await workspace.openTextDocument({
          language: 'json',
          content: JSON.stringify(entry, null, 2),
        });
        await window.showTextDocument(document);
      }),
    );
  }
  public async forSource(source: string): Promise<KernelRpcClient> {
    this.transitioning = this.transitioning
      .catch(() => {})
      .then(async () => {
        if (!this.isCovered(source)) {
          this.roots.add(dirname(source));
          await this.client?.attachWorkspaceRoots([...this.roots]);
        }
        if (!this.client) {
          this.client = await connectSharedKernel(
            this.executable(),
            this.storeRoot,
            [...this.roots],
            (message) => this.output.append(message),
          );
        }
      });
    await this.transitioning;
    if (!this.client) throw new Error('Judge kernel client was not initialized');
    return this.client;
  }
  private output = window.createOutputChannel('CPH-NG Judge Kernel');
  private isCovered(source: string): boolean {
    return [...this.roots].some((root) => {
      const path = relative(root, source);
      return path === '' || (!path.startsWith('..') && !isAbsolute(path));
    });
  }
  public executable(): string {
    const filename = process.platform === 'win32' ? 'cph-ng-judge.exe' : 'cph-ng-judge';
    const bundled = join(
      this.context.extensionPath,
      'bin',
      `${process.platform}-${process.arch}`,
      filename,
    );
    return (
      workspace.getConfiguration('cph-ng').get<string>('kernel.executablePath') ||
      process.env.CPH_NG_JUDGE ||
      (existsSync(bundled) ? bundled : filename)
    );
  }
  public async forConfiguration(): Promise<KernelRpcClient> {
    const root = workspace.workspaceFolders?.[0]?.uri.fsPath ?? this.storeRoot;
    return this.forSource(join(root, '.cph-ng-settings'));
  }
  public addSubscription(disposable: { dispose(): unknown }): void {
    this.context.subscriptions.push(disposable);
  }
  public async dispose(): Promise<void> {
    await this.transitioning.catch(() => {});
    await this.client?.dispose();
    this.output.dispose();
  }
}

export { splitArguments } from './arguments';

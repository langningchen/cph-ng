// biome-ignore-all lint/style/useNamingConvention: JSON-RPC fields follow the Rust wire schema.
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createConnection, type Socket } from 'node:net';
import { type RpcMethod, rpcErrorCode, rpcEventMethod, rpcMethod } from './protocol';

export interface RpcErrorData {
  /** Preserve unknown codes from newer kernels. */
  code: number;
  message: string;
  data?: unknown;
}
export class RpcRemoteError extends Error {
  public constructor(
    /** Preserve unknown codes from newer kernels. */
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
  }
}
export interface TaskInfo {
  schema_version: number;
  task_id: string;
  kind: string;
  problem_id?: string;
  code_id?: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  result?: Record<string, unknown>;
  error?: RpcErrorData;
}
export interface TaskEvent extends TaskInfo {
  sequence: number;
  kind: string;
}
export interface ClientOptions {
  command: string;
  args: string[];
  timeoutMs?: number;
  startupTimeoutMs?: number;
  /** Local Unix socket or Windows named pipe; no child is owned in this mode. */
  endpoint?: string;
  workspaceRoots?: string[];
  ensureServer?: () => Promise<void>;
  maxMessageBytes?: number;
  log?: (message: string) => void;
}
interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}
const terminal = (task: TaskInfo) => ['succeeded', 'failed', 'canceled'].includes(task.state);

/** JSONL client independent of VS Code, with bounded framing and task event recovery. */
export class KernelRpcClient {
  public readonly events = new EventEmitter();
  private process?: ChildProcessWithoutNullStreams;
  private socket?: Socket;
  private starting?: Promise<void>;
  private connected = false;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private disposed = false;
  private buffer = Buffer.alloc(0);
  private ready?: () => void;
  private rejectReady?: (error: Error) => void;
  public constructor(private readonly options: ClientOptions) {}

  public async connect(): Promise<void> {
    if (this.disposed) throw new Error('Judge kernel client is closed');
    if (this.starting) return this.starting;
    this.starting = this.start()
      .then(() => {
        this.connected = true;
      })
      .catch((error: unknown) => {
        this.starting = undefined;
        throw error;
      });
    return this.starting;
  }
  private async start(): Promise<void> {
    if (this.options.endpoint) {
      try {
        await this.startSocket(this.options.endpoint);
      } catch (error) {
        if (!this.options.ensureServer || error instanceof RpcRemoteError || this.disposed)
          throw error;
        await this.options.ensureServer();
        await this.startSocket(this.options.endpoint);
      }
      return;
    }
    const child = spawn(this.options.command, this.options.args, {
      stdio: 'pipe',
      windowsHide: true,
      shell: false,
    });
    this.process = child;
    this.buffer = Buffer.alloc(0);
    const initialized = new Promise<void>((resolve, reject) => {
      this.ready = resolve;
      this.rejectReady = reject;
    });
    const fail = (error: Error) => {
      if (this.process !== child) return;
      this.process = undefined;
      if (this.connected) this.starting = undefined;
      this.connected = false;
      this.rejectReady?.(error);
      this.rejectReady = undefined;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.events.emit('disconnected', error);
    };
    child.on('error', fail);
    child.on('exit', (code, signal) => fail(new Error(`Judge kernel exited (${signal ?? code})`)));
    child.stdin.on('error', fail);
    child.stderr.on('data', (chunk: Buffer) => this.options.log?.(chunk.toString('utf8')));
    child.stdout.on('data', (chunk: Buffer) => {
      try {
        this.consume(chunk);
      } catch (error) {
        fail(error as Error);
        child.kill();
      }
    });
    const timer = setTimeout(
      () => {
        fail(new Error('Judge kernel startup timed out'));
        child.kill();
      },
      this.options.startupTimeoutMs ?? this.options.timeoutMs ?? 30_000,
    );
    try {
      await initialized;
      const hello = await this.raw<{ protocol_version: string }>(rpcMethod.systemHello, {
        protocol_version: '1.0',
      });
      if (hello.protocol_version.split('.')[0] !== '1')
        throw new Error('Unsupported judge kernel protocol');
    } catch (error) {
      fail(error as Error);
      child.kill();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  private async startSocket(endpoint: string): Promise<void> {
    const socket = createConnection(endpoint);
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    const initialized = new Promise<void>((resolve, reject) => {
      this.ready = resolve;
      this.rejectReady = reject;
    });
    const fail = (error: Error) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (this.connected) this.starting = undefined;
      this.connected = false;
      this.rejectReady?.(error);
      this.rejectReady = undefined;
      this.ready = undefined;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.events.emit('disconnected', error);
    };
    socket.on('error', fail);
    socket.on('close', () => fail(new Error('Judge kernel connection closed')));
    socket.on('data', (chunk: Buffer) => {
      try {
        this.consume(chunk);
      } catch (error) {
        fail(error as Error);
        socket.destroy();
      }
    });
    const timer = setTimeout(
      () => {
        fail(new Error('Judge kernel connection timed out'));
        socket.destroy();
      },
      this.options.startupTimeoutMs ?? this.options.timeoutMs ?? 30_000,
    );
    try {
      await initialized;
      const hello = await this.raw<{ protocol_version: string }>(rpcMethod.systemHello, {
        protocol_version: '1.0',
      });
      if (hello.protocol_version.split('.')[0] !== '1')
        throw new Error('Unsupported judge kernel protocol');
      await this.raw(rpcMethod.systemAttach, {
        workspace_roots: this.options.workspaceRoots ?? [],
      });
    } catch (error) {
      fail(error as Error);
      socket.destroy();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const newline = this.buffer.indexOf(10);
      if (newline < 0) break;
      if (newline > (this.options.maxMessageBytes ?? 32 * 1024 * 1024))
        throw new Error('Judge kernel message exceeds limit');
      const line = this.buffer.subarray(0, newline).toString('utf8');
      this.buffer = this.buffer.subarray(newline + 1);
      const data: unknown = JSON.parse(line);
      if (Array.isArray(data)) for (const message of data) this.receive(message);
      else this.receive(data);
    }
    if (this.buffer.length > (this.options.maxMessageBytes ?? 32 * 1024 * 1024))
      throw new Error('Judge kernel message exceeds limit');
  }
  private receive(data: unknown): void {
    if (!data || typeof data !== 'object') throw new Error('Invalid judge kernel message');
    const message = data as {
      jsonrpc?: string;
      id?: number;
      method?: string;
      result?: unknown;
      error?: RpcErrorData;
      params?: unknown;
    };
    if (message.jsonrpc !== '2.0') throw new Error('Invalid judge kernel protocol');
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error)
        pending.reject(
          new RpcRemoteError(message.error.code, message.error.message, message.error.data),
        );
      else pending.resolve(message.result);
    } else if (message.method) {
      if (message.method === rpcEventMethod.serverReady) {
        this.ready?.();
        this.ready = undefined;
      }
      this.events.emit('notification', message.method, message.params);
      if (message.method.startsWith('event.task.')) this.events.emit('task', message.params);
    }
  }
  public async request<T>(method: RpcMethod, params: Record<string, unknown> = {}): Promise<T> {
    await this.connect();
    return this.raw<T>(method, params);
  }
  public async attachWorkspaceRoots(roots: string[]): Promise<void> {
    this.options.workspaceRoots = [...new Set([...(this.options.workspaceRoots ?? []), ...roots])];
    await this.request(rpcMethod.systemAttach, { workspace_roots: this.options.workspaceRoots });
  }
  private raw<T>(method: RpcMethod, params: Record<string, unknown>): Promise<T> {
    const input = this.socket ?? this.process?.stdin;
    if (!input) return Promise.reject(new Error('Judge kernel is disconnected'));
    if (this.pending.size >= 128)
      return Promise.reject(new Error('Too many pending judge kernel requests'));
    const id = ++this.nextId;
    const line = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
    if (Buffer.byteLength(line) > 4 * 1024 * 1024)
      return Promise.reject(new Error('Judge kernel request exceeds limit'));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Judge kernel request timed out: ${method}`));
      }, this.options.timeoutMs ?? 30_000);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      input.write(line, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }
  public async runTask(
    method: RpcMethod,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onEvent?: (event: TaskEvent) => void,
  ): Promise<TaskInfo> {
    if (signal?.aborted) throw new RpcRemoteError(rpcErrorCode.taskState, 'Task canceled');
    const request = { client_request_id: randomUUID(), ...params };
    let task: TaskInfo;
    try {
      task = await this.request<TaskInfo>(method, request);
    } catch (error) {
      if (error instanceof RpcRemoteError || this.disposed) throw error;
      task = await this.request<TaskInfo>(method, request);
    }
    return this.waitTask(task.task_id, signal, onEvent);
  }
  public async waitTask(
    taskId: string,
    signal?: AbortSignal,
    onEvent?: (event: TaskEvent) => void,
  ): Promise<TaskInfo> {
    let sequence = 0;
    let final: TaskInfo | undefined;
    let abortSent = false;
    const event = (event: TaskEvent) => {
      if (event.task_id !== taskId || event.sequence <= sequence) return;
      sequence = event.sequence;
      onEvent?.(event);
      if (terminal(event)) final = event;
    };
    this.events.on('task', event);
    const deadline = Date.now() + 360_000;
    try {
      while (!final) {
        if (this.disposed) throw new Error('Judge kernel client is closed');
        try {
          if (signal?.aborted && !abortSent) {
            try {
              await this.request(rpcMethod.taskCancel, { task_id: taskId });
            } catch (error) {
              if (!(error instanceof RpcRemoteError) || error.code !== rpcErrorCode.taskState)
                throw error;
            }
            abortSent = true;
          }
          // Replay closes both the response/notification race and reconnect gaps.
          const events = await this.request<TaskEvent[]>(rpcMethod.taskEventsSince, {
            task_id: taskId,
            sequence,
          });
          for (const entry of events) event(entry);
          if (!final) {
            const current = await this.request<TaskInfo>(rpcMethod.taskGet, {
              task_id: taskId,
            });
            if (terminal(current)) final = current;
          }
        } catch (error) {
          if (error instanceof RpcRemoteError || this.disposed) throw error;
        }
        if (Date.now() > deadline) throw new Error('Timed out waiting for judge task');
        if (!final) await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      final = await this.request<TaskInfo>(rpcMethod.taskGet, { task_id: taskId });
      if (final.state !== 'succeeded')
        throw new RpcRemoteError(
          final.error?.code ?? rpcErrorCode.taskState,
          final.error?.message ?? 'Task canceled',
          final.error?.data,
        );
      return final;
    } finally {
      this.events.off('task', event);
    }
  }
  public async dispose(): Promise<void> {
    if (this.disposed) return;
    if (this.options.endpoint) {
      this.disposed = true;
      this.socket?.destroy();
      this.events.removeAllListeners();
      return;
    }
    const child = this.process;
    if (child) {
      try {
        await this.raw(rpcMethod.systemShutdown, {});
      } catch {
        /* The process may already have exited. */
      }
      await Promise.race([
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) resolve();
          else child.once('exit', () => resolve());
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
    this.disposed = true;
    this.events.removeAllListeners();
  }
}

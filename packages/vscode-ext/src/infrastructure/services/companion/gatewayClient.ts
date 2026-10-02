import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
/** Standard WebSocket JSON-RPC client; never exposes judge methods to the browser. */
export class GatewayClient {
  public readonly events = new EventEmitter();
  public connected = false;
  private socket?: WebSocket;
  private stopped = false;
  private reconnect?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  public constructor(
    private readonly port: number,
    private readonly token: string,
  ) {}
  public connect(): void {
    if (this.stopped || this.socket) return;
    this.events.emit('reconnecting');
    const socket = new WebSocket(`ws://127.0.0.1:${this.port}/ws`, {
      maxPayload: 4 * 1024 * 1024,
      handshakeTimeout: 5000,
    });
    this.socket = socket;
    socket.on('open', () => {
      void this.request('router.hello', { role: 'vscode', token: this.token })
        .then(() => {
          if (this.socket !== socket) return;
          this.connected = true;
          this.events.emit('connect');
          this.heartbeat = setInterval(() => {
            void this.request('system.ping').catch(() => socket.close());
          }, 20000);
        })
        .catch(() => socket.close());
    });
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.jsonrpc !== '2.0') throw new Error('Invalid gateway protocol');
        if (message.id !== undefined) {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(String(message.error.message)));
          else pending.resolve(message.result);
        } else if (typeof message.method === 'string')
          this.events.emit('notification', message.method, message.params);
      } catch {
        socket.close();
      }
    });
    socket.on('error', () => socket.close());
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.connected = false;
      clearInterval(this.heartbeat);
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Gateway disconnected'));
      }
      this.pending.clear();
      this.events.emit('disconnect');
      if (!this.stopped) this.reconnect = setTimeout(() => this.connect(), 1500);
    });
  }
  public request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error('Gateway is disconnected'));
    if (this.pending.size >= 64) return Promise.reject(new Error('Too many gateway requests'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timed out: ${method}`));
      }, 10000);
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      this.socket?.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
  public close(): void {
    this.stopped = true;
    clearTimeout(this.reconnect);
    clearInterval(this.heartbeat);
    this.socket?.close();
  }
}

/** Browser transport for the local Rust gateway; credentials never go in a URL. */
export class BrowserGateway {
  public connected = false;
  public onStatus: (connected: boolean) => void = () => {};
  public onNotification: (method: string, params: Record<string, unknown>) => void = () => {};
  private socket?: WebSocket;
  private stopped = false;
  private reconnect?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private handshake?: ReturnType<typeof setTimeout>;
  private nextId = 1;
  public constructor(
    private readonly port: number,
    private readonly token: string,
  ) {}
  public connect(): void {
    if (this.stopped || this.socket) return;
    const socket = new WebSocket(`ws://127.0.0.1:${this.port}/ws`);
    this.socket = socket;
    this.handshake = setTimeout(() => socket.close(), 7000);
    socket.onopen = () => this.send('router.hello', { role: 'browser', token: this.token }, 1);
    socket.onmessage = ({ data }) => {
      try {
        if (typeof data !== 'string' || data.length > 4 * 1024 * 1024)
          throw new Error('Oversized gateway message');
        const message = JSON.parse(data);
        if (message.jsonrpc !== '2.0') throw new Error('Invalid gateway protocol');
        if (message.id === 1) {
          if (message.error || message.result?.protocol_version !== '1.0') {
            socket.close();
            return;
          }
          clearTimeout(this.handshake);
          this.connected = true;
          this.onStatus(true);
          // Traffic keeps the MV3 service worker's WebSocket alive.
          this.heartbeat = setInterval(() => this.send('system.ping'), 20000);
        } else if (
          typeof message.method === 'string' &&
          message.params &&
          typeof message.params === 'object'
        ) {
          this.onNotification(message.method, message.params);
        }
      } catch {
        socket.close();
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.connected = false;
      clearTimeout(this.handshake);
      clearInterval(this.heartbeat);
      this.onStatus(false);
      if (!this.stopped) this.reconnect = setTimeout(() => this.connect(), 3000);
    };
  }
  public send(method: string, params: Record<string, unknown> = {}, id = ++this.nextId): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  }
  public close(): void {
    this.stopped = true;
    clearTimeout(this.reconnect);
    clearTimeout(this.handshake);
    clearInterval(this.heartbeat);
    this.socket?.close();
  }
}

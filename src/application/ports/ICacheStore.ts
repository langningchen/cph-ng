export interface ICacheStore {
  ensureDir(): Promise<void>;
  startMonitor(): Promise<void>;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

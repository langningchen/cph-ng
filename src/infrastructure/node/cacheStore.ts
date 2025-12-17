import type { ICacheStore } from '@/application/ports/ICacheStore';
import Cache from '@/helpers/cache';

export class CacheStoreAdapter implements ICacheStore {
  async ensureDir(): Promise<void> {
    await Cache.ensureDir();
  }

  async startMonitor(): Promise<void> {
    await Cache.startMonitor();
  }

  async get(_key: string): Promise<string | undefined> {
    // Current Cache helper does not expose a get API; left as stub for future extension.
    return undefined;
  }

  async set(_key: string, _value: string): Promise<void> {
    // Stub to align with port; real caching to be added later.
  }
}

export default CacheStoreAdapter;

import type { IClock } from '@/application/ports/IClock';

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}

export default SystemClock;

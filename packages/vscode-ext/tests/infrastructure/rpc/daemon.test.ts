// biome-ignore-all lint/style/useNamingConvention: Mock exports preserve module class names.
import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { connectSharedKernel } from '@/infrastructure/rpc/daemon';

const state = vi.hoisted(() => ({ launches: 0, attempts: 0, exited: true }));
vi.mock('node:fs', () => ({ openSync: () => 1, closeSync: () => {} }));
vi.mock('node:fs/promises', () => ({
  mkdir: async () => {},
  realpath: async (path: string) => path,
  chmod: async () => {},
  lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: 123 }),
}));
vi.mock('node:os', () => ({ tmpdir: () => '/tmp', userInfo: () => ({ uid: 123 }) }));
vi.mock('node:child_process', () => ({
  spawn: () => {
    state.launches++;
    const child = Object.assign(new EventEmitter(), {
      exitCode: state.exited && state.launches === 1 ? 1 : null,
      signalCode: null,
      unref: () => {},
    });
    queueMicrotask(() => child.emit('spawn'));
    return child;
  },
}));
vi.mock('@/infrastructure/rpc/client', () => ({
  RpcRemoteError: class extends Error {},
  KernelRpcClient: class {
    public async connect() {
      state.attempts++;
      if (state.launches < (state.exited ? 2 : 1) || state.attempts < 5)
        throw new Error('Endpoint unavailable');
    }
    public async dispose() {}
  },
}));
afterEach(() => vi.useRealTimers());

it.each([true, false])(
  'recovers an exited contender without duplicating a live startup (%s)',
  async (exited) => {
    vi.useFakeTimers();
    Object.assign(state, { launches: 0, attempts: 0, exited });
    const connecting = connectSharedKernel('kernel', '/store', ['/workspace'], () => {});
    await vi.advanceTimersByTimeAsync(1000);
    await expect(connecting).resolves.toBeDefined();
    expect(state.launches).toBe(exited ? 2 : 1);
  },
);

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const configModulePath = new URL('../../../vscode-router/src/config.ts', import.meta.url).href;
const shutdownModulePath = new URL('../../../vscode-router/src/shutdown.ts', import.meta.url).href;

const loadConfigModule = async (): Promise<{
  config: { logFile: string; shutdownTimeout: number };
  initializeConfig: (argv?: string[]) => Promise<void>;
}> => import(configModulePath);

const loadShutdownModule = async (): Promise<{
  shouldScheduleShutdown: (totalClients: number, shutdownTimeout: number) => boolean;
}> => import(shutdownModulePath);

vi.mock('proper-lockfile', () => ({
  lock: vi.fn().mockResolvedValue(undefined),
}));

describe('router config', () => {
  const originalArgv = [...process.argv];
  const tempDirs: string[] = [];

  afterEach(() => {
    process.argv = [...originalArgv];
    for (const dir of tempDirs) rmSync(dir, { force: true, recursive: true });
    tempDirs.length = 0;
    vi.resetModules();
  });

  it('accepts shutdownTimeout=0 and still initializes logging', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cph-ng-router-config-'));
    tempDirs.push(dir);
    const logFile = join(dir, 'router.log');
    process.argv = ['node', 'router.cjs', '-p', '27121', '-l', logFile, '-s', '0'];

    const { config, initializeConfig } = await loadConfigModule();
    await initializeConfig(process.argv);

    expect(config.shutdownTimeout).toBe(0);
    expect(config.logFile).toBe(logFile);
    expect(existsSync(logFile)).toBe(true);
  });

  it('rejects negative shutdownTimeout values', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cph-ng-router-config-'));
    tempDirs.push(dir);
    const logFile = join(dir, 'router.log');
    process.argv = ['node', 'router.cjs', '-p', '27121', '-l', logFile, '-s', '-1'];

    const { initializeConfig } = await loadConfigModule();
    await expect(initializeConfig(process.argv)).rejects.toThrow('Invalid timeout');
  });
});

describe('shutdown scheduling', () => {
  it('does not schedule auto-shutdown when timeout is disabled', async () => {
    const { shouldScheduleShutdown } = await loadShutdownModule();
    expect(shouldScheduleShutdown(0, 0)).toBe(false);
  });

  it('schedules auto-shutdown when there are no clients and timeout is positive', async () => {
    const { shouldScheduleShutdown } = await loadShutdownModule();
    expect(shouldScheduleShutdown(0, 10000)).toBe(true);
  });

  it('does not schedule auto-shutdown while clients are connected', async () => {
    const { shouldScheduleShutdown } = await loadShutdownModule();
    expect(shouldScheduleShutdown(1, 10000)).toBe(false);
  });
});

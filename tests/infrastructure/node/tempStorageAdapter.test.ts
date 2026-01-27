// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { fileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { systemMock } from '@t/infrastructure/node/systemMock';
import { PathResolverMock } from '@t/infrastructure/services/pathResolverMock';
import { vol } from 'memfs';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKENS } from '@/composition/tokens';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { extensionPathMock } from '../vscode/extensionPathMock';
import { loggerMock } from '../vscode/loggerMock';
import { settingsMock } from '../vscode/settingsMock';
import { cryptoMock } from './cryptoMock';

describe('TempStorageAdapter', () => {
  let adapter: TempStorageAdapter;

  beforeEach(() => {
    container.registerInstance(TOKENS.crypto, cryptoMock);
    container.registerInstance(TOKENS.extensionPath, extensionPathMock);
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.system, systemMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerSingleton(TOKENS.path, PathAdapter);
    container.registerSingleton(TOKENS.pathResolver, PathResolverMock);

    adapter = container.resolve(TempStorageAdapter);
  });

  it('should create a new path using crypto and settings when pool is empty', () => {
    const path = adapter.create('test');

    expect(path).equals('/tmp/cph-ng/u-u-i-d-0');
    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(1);
    expect(vol.existsSync(path)).toBe(true);
  });

  it('should reuse a path from the free pool after it has been disposed', () => {
    const path1 = adapter.create('test');
    adapter.dispose(path1);
    const path2 = adapter.create('test');
    expect(path2).toBe(path1);
    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(1);
    expect(vol.existsSync(path1)).toBe(true);
  });

  it('should manage multiple paths in the pool correctly', () => {
    const p1 = adapter.create('test');
    const p2 = adapter.create('test');
    const p3 = adapter.create('test');

    expect(p1).not.toBe(p2);
    expect(p2).not.toBe(p3);
    expect(p3).not.toBe(p1);

    adapter.dispose([p1, p2]);

    const r1 = adapter.create('test');
    const r2 = adapter.create('test');
    const r3 = adapter.create('test');

    expect(p1).equals('/tmp/cph-ng/u-u-i-d-0');
    expect(p2).equals('/tmp/cph-ng/u-u-i-d-1');
    expect(p3).equals('/tmp/cph-ng/u-u-i-d-2');
    expect(r1).equals('/tmp/cph-ng/u-u-i-d-0');
    expect(r2).equals('/tmp/cph-ng/u-u-i-d-1');
    expect(r3).equals('/tmp/cph-ng/u-u-i-d-3');
    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(4);
    expect(vol.existsSync(r1)).toBe(true);
    expect(vol.existsSync(r2)).toBe(true);
    expect(vol.existsSync(r3)).toBe(true);
    expect(vol.existsSync(p3)).toBe(true);
  });

  it('should warn when disposing the same path multiple times', () => {
    const path = adapter.create('test');
    adapter.dispose(path);
    adapter.dispose(path);

    expect(loggerMock.warn).toHaveBeenCalledWith('Duplicate dispose path', expect.anything());
  });

  it('should log debug message when disposing a path not managed by the adapter', () => {
    const externalPath = '/some/other/path';
    adapter.dispose(externalPath);

    expect(loggerMock.debug).toHaveBeenCalledWith(`Path ${externalPath} is not disposable`);
  });

  it('should handle array of paths in dispose method', () => {
    const paths = [adapter.create('test'), adapter.create('test')];
    adapter.dispose(paths);

    const newPath = adapter.create('test');
    expect(paths).toContain(newPath);
  });

  it('should not reuse a path that is currently in use', () => {
    const p1 = adapter.create('test');
    const p2 = adapter.create('test');

    expect(p1).not.toBe(p2);

    adapter.dispose(p1);
    const p3 = adapter.create('test');

    expect(p3).toBe(p1);
    expect(p3).not.toBe(p2);
  });

  it('should start monitor and log pool status periodically', () => {
    vi.useFakeTimers();

    const p1 = adapter.create('test1');
    const p2 = adapter.create('test2');
    adapter.dispose(p1);

    loggerMock.info.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.trace.mockClear();

    adapter.startMonitor();
    expect(loggerMock.info).toHaveBeenCalledWith('Monitor started');

    vi.advanceTimersByTime(10000);
    expect(loggerMock.debug).toHaveBeenCalledWith('Currently 1 used, 1 free');
    expect(loggerMock.trace).toHaveBeenLastCalledWith('Used paths', { [p2]: 'test2' });

    vi.advanceTimersByTime(10000);
    expect(loggerMock.debug).toHaveBeenCalledTimes(2);
    expect(loggerMock.trace).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should not start multiple intervals if called multiple times', () => {
    adapter.startMonitor();
    expect(loggerMock.info).toHaveBeenCalledWith('Monitor started');
    adapter.startMonitor();
    expect(loggerMock.warn).toBeCalledWith('Already started monitoring');
  });
});

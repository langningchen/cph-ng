// Copyright (C) 2025 Langning Chen
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

import { join } from 'node:path';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';

describe('TempStorageAdapter', () => {
  let adapter: TempStorageAdapter;
  let loggerMock: MockProxy<ILogger>;
  let fsMock: MockProxy<IFileSystem>;
  let cryptoMock: MockProxy<ICrypto>;
  let settingsMock: MockProxy<ISettings>;

  const MOCK_CACHE_DIR = '/mock/cache';

  beforeEach(() => {
    loggerMock = mock<ILogger>();
    fsMock = mock<IFileSystem>();
    cryptoMock = mock<ICrypto>();
    settingsMock = mock<ISettings>({
      cache: {
        directory: MOCK_CACHE_DIR,
      },
    });

    loggerMock.withScope.mockReturnValue(loggerMock);

    fsMock.join.mockImplementation(join);

    let uuidCnt = 0;
    cryptoMock.randomUUID.mockImplementation(() => `uuid-${uuidCnt++}`);

    // 注册实例
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.Crypto, cryptoMock);
    container.registerInstance(TOKENS.Settings, settingsMock);

    adapter = container.resolve(TempStorageAdapter);
  });

  it('should create a new path using crypto and settings when pool is empty', () => {
    const path = adapter.create();

    expect(path).toBe(`${MOCK_CACHE_DIR}/uuid-0`);
    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(1);
    expect(loggerMock.trace).toHaveBeenCalledWith(
      expect.stringContaining('Creating new'),
      path,
    );
  });

  it('should reuse a path from the free pool after it has been disposed', () => {
    const path1 = adapter.create();
    adapter.dispose(path1);
    expect(loggerMock.trace).toHaveBeenCalledWith(
      expect.stringContaining('Disposing'),
      path1,
    );

    const path2 = adapter.create();
    expect(path2).toBe(path1);
    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(1);
    expect(loggerMock.trace).toHaveBeenCalledWith(
      expect.stringContaining('Reusing cached'),
      path2,
    );
  });

  it('should manage multiple paths in the pool correctly', () => {
    const p1 = adapter.create();
    const p2 = adapter.create();
    const p3 = adapter.create();

    expect(p1).not.toBe(p2);
    expect(p2).not.toBe(p3);
    expect(p3).not.toBe(p1);

    adapter.dispose([p1, p2]);

    const r1 = adapter.create();
    const r2 = adapter.create();
    const r3 = adapter.create();

    const reusedPaths = [r1, r2];
    expect(reusedPaths).toContain(p1);
    expect(reusedPaths).toContain(p2);
    expect(r3).toBe(`${MOCK_CACHE_DIR}/uuid-3`);
  });

  it('should warn when disposing the same path multiple times', () => {
    const path = adapter.create();
    adapter.dispose(path);
    adapter.dispose(path);

    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate dispose'),
      path,
    );
  });

  it('should log debug message when disposing a path not managed by the adapter', () => {
    const externalPath = '/some/other/path';

    adapter.dispose(externalPath);

    expect(loggerMock.debug).toHaveBeenCalledWith(
      'Path',
      externalPath,
      expect.stringContaining('not disposable'),
    );
  });

  it('should handle array of paths in dispose method', () => {
    const paths = [adapter.create(), adapter.create()];
    adapter.dispose(paths);

    const newPath = adapter.create();
    expect(paths).toContain(newPath);
  });

  it('should not reuse a path that is currently in use', () => {
    const p1 = adapter.create();
    const p2 = adapter.create();

    expect(p1).not.toBe(p2);

    adapter.dispose(p1);
    const p3 = adapter.create();

    expect(p3).toBe(p1);
    expect(p3).not.toBe(p2);
  });

  it('should start monitor and log pool status periodically', () => {
    vi.useFakeTimers();

    const p1 = adapter.create();
    const p2 = adapter.create();
    adapter.dispose(p1);

    adapter.startMonitor();

    expect(loggerMock.info).toHaveBeenCalledWith('Cache monitor started');

    vi.advanceTimersByTime(10000);

    expect(loggerMock.debug).toHaveBeenCalledWith(
      expect.stringContaining('this Monitor: 1 used, 1 free.'),
    );

    expect(loggerMock.trace).toHaveBeenCalledWith('Used paths', [p2]);
    expect(loggerMock.trace).toHaveBeenCalledWith('Free paths', [p1]);

    vi.advanceTimersByTime(10000);
    expect(loggerMock.debug).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should not start multiple intervals if called multiple times', () => {
    vi.useFakeTimers();

    adapter.startMonitor();
    adapter.startMonitor();

    expect(loggerMock.info).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);
    expect(loggerMock.debug).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

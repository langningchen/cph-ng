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

import echoCode from '@t/fixtures/echo?raw';
import helloWorldCode from '@t/fixtures/helloWorld?raw';
import pingCode from '@t/fixtures/ping?raw';
import pongCode from '@t/fixtures/pong?raw';
import timeoutCode from '@t/fixtures/timeout?raw';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import { stdinPath } from '@t/infrastructure/problems/runner/strategies/constants';
import type { Volume } from 'memfs';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { AbortReason, type ProcessOutput } from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { loggerMock } from '../vscode/loggerMock';
import { telemetryMock } from '../vscode/telemetryMock';

describe('ProcessExecutorAdapter', () => {
  let adapter: ProcessExecutorAdapter;
  let fileSystemMock: MockProxy<IFileSystem>;
  let tempStorageMock: TempStorageMock;
  let vol: Volume;

  beforeEach(() => {
    ({ fileSystemMock, vol } = createFileSystemMock());

    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.telemetry, telemetryMock);
    container.registerSingleton(TOKENS.clock, ClockAdapter);
    container.registerSingleton(TOKENS.path, PathAdapter);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);

    adapter = container.resolve(ProcessExecutorAdapter);
    tempStorageMock = container.resolve(TOKENS.tempStorage) as TempStorageMock;
  });

  const assertOutput = async (res: ProcessOutput, stdout: string, stderr: string) => {
    expect(await vol.promises.readFile(res.stdoutPath, 'utf-8')).toBe(stdout);
    expect(await vol.promises.readFile(res.stderrPath, 'utf-8')).toBe(stderr);
  };

  it('should successfully execute a simple command and capture output', async () => {
    const result = await adapter.execute({ cmd: ['node', '-e', helloWorldCode] });
    console.log(result);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      await assertOutput(result, 'hello', 'world');
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should return Timeout status when the process times out', async () => {
    const result = await adapter.execute({ cmd: ['node', '-e', timeoutCode], timeoutMs: 100 });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 'SIGTERM',
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: AbortReason.Timeout,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      expect(result.timeMs).lessThan(200).greaterThan(100);
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should correctly handle stdin input', async () => {
    const data = 'hello_file';
    await fileSystemMock.safeWriteFile(stdinPath, data);
    const result = await adapter.execute({ cmd: ['node', '-e', echoCode], stdinPath });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      await assertOutput(result, data, '');
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should support executeWithPipe (interaction simulation)', async () => {
    const { res1, res2 } = await adapter.executeWithPipe(
      { cmd: ['node', '-e', pingCode] },
      { cmd: ['node', '-e', pongCode] },
    );
    expect(res1).not.toBeInstanceOf(Error);
    expect(res1).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(res1 instanceof Error)) await assertOutput(res1, 'ping', 'ok');

    expect(res2).not.toBeInstanceOf(Error);
    expect(res2).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(res2 instanceof Error)) await assertOutput(res2, 'pong', 'ok');

    if (!(res1 instanceof Error) && !(res2 instanceof Error))
      tempStorageMock.checkFile([
        res1.stdoutPath,
        res1.stderrPath,
        res2.stdoutPath,
        res2.stderrPath,
      ]);
  });

  it('should stop execution when an external AbortController is aborted', async () => {
    const ac = new AbortController();
    const promise = adapter.execute({ cmd: ['node', '-e', timeoutCode], signal: ac.signal });
    setTimeout(() => ac.abort(), 100);

    const result = await promise;
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 'SIGTERM',
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: AbortReason.UserAbort,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      expect(result.timeMs).greaterThan(100).lessThan(200);
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should allow manual process control via handle in spawn mode', async () => {
    const handle = adapter.spawn({ cmd: ['node', '-e', echoCode] });
    expect(handle.pid).toBeGreaterThan(0);

    handle.writeStdin('manual_input');
    handle.closeStdin();

    const result = await handle.wait();
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 0,
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      await assertOutput(result, 'manual_input', '');
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should allow manual process control via handle in spawn mode', async () => {
    const handle = adapter.spawn({ cmd: ['node', '-e', echoCode] });
    expect(handle.pid).toBeGreaterThan(0);

    handle.kill();

    const result = await handle.wait();
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toStrictEqual({
      codeOrSignal: 'SIGTERM',
      stdoutPath: expect.any(String),
      stderrPath: expect.any(String),
      timeMs: expect.any(Number),
      abortReason: undefined,
    } satisfies ProcessOutput);
    if (!(result instanceof Error)) {
      await assertOutput(result, '', '');
      tempStorageMock.checkFile([result.stdoutPath, result.stderrPath]);
    }
  });

  it('should return error if the program does not exists', async () => {
    const result = await adapter.execute({ cmd: ['non_exists'] });
    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) tempStorageMock.checkFile();
  });
});

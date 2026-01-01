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

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { container } from 'tsyringe';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { AbortReason } from '@/application/ports/node/IProcessExecutor';
import { TOKENS } from '@/composition/tokens';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { loggerMock } from '../vscode/loggerMock';
import { telemetryMock } from '../vscode/telemetryMock';
import { tempStorageMock } from './tempStorageMock';

describe('ProcessExecutorAdapter', () => {
  let adapter: ProcessExecutorAdapter;
  let fsMock: MockProxy<IFileSystem>;

  const realTmpDir = join(tmpdir(), `cph-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(realTmpDir, { recursive: true });

    fsMock = mock<IFileSystem>();

    fsMock.cwd.mockReturnValue(process.cwd());
    fsMock.dirname.mockImplementation((p) => dirname(p));

    container.registerInstance(TOKENS.TempStorage, tempStorageMock);
    container.registerInstance(TOKENS.FileSystem, fsMock);
    container.registerInstance(TOKENS.Logger, loggerMock);
    container.registerInstance(TOKENS.Telemetry, telemetryMock);
    container.registerSingleton(TOKENS.Clock, ClockAdapter);

    adapter = container.resolve(ProcessExecutorAdapter);
  });

  afterAll(() => {
    rmSync(realTmpDir, { recursive: true, force: true });
  });

  it('should successfully execute a simple command and capture output', async () => {
    const result = await adapter.execute({
      cmd: ['node', '-e', `console.log('hello'); console.error('world');`],
    });
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(readFileSync(result.stdoutPath, 'utf-8').trim()).toBe('hello');
      expect(readFileSync(result.stderrPath, 'utf-8').trim()).toBe('world');
    }
  });

  it('should return Timeout status when the process times out', async () => {
    const result = await adapter.execute({
      cmd: ['node', '-e', `setTimeout(() => {}, 2000);`],
      timeoutMs: 100,
    });
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.timeMs).lessThan(2000).greaterThan(100);
      expect(result.abortReason).toBe(AbortReason.Timeout);
    }
  });

  it('should correctly handle stdin input', async () => {
    const inputFile = tempStorageMock.create();
    writeFileSync(inputFile, 'hello_file');
    const result = await adapter.execute({
      cmd: [
        'node',
        '-e',
        `process.stdin.on('data', (d) => process.stdout.write('rec:' + d));`,
      ],
      stdinPath: inputFile,
    });
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(readFileSync(result.stdoutPath, 'utf-8')).toBe('rec:hello_file');
    }
  });

  it('should support executeWithPipe (interaction simulation)', async () => {
    const { res1, res2 } = await adapter.executeWithPipe(
      {
        cmd: [
          'node',
          '-e',
          `
console.log('ping');
process.stdin.on('data', (d) => {
    if (d.toString().trim() === 'pong') {
        console.error('ok');
        process.exit(0);
    }
});`,
        ],
      },
      {
        cmd: [
          'node',
          '-e',
          `
process.stdin.on('data', (d) => {
    if (d.toString().trim() === 'ping') {
        console.log('pong');
        process.exit(0);
    }
});`,
        ],
      },
    );

    expect(res1).not.toBeInstanceOf(Error);
    expect(res2).not.toBeInstanceOf(Error);
    if (!(res1 instanceof Error) && !(res2 instanceof Error)) {
      expect(res1.codeOrSignal).toBe(0);
      expect(res2.codeOrSignal).toBe(0);
      expect(readFileSync(res1.stdoutPath, 'utf-8').trim()).toBe('ping');
      expect(readFileSync(res1.stderrPath, 'utf-8').trim()).toBe('ok');
      expect(readFileSync(res2.stdoutPath, 'utf-8').trim()).toBe('pong');
    }
  });

  it('should stop execution when an external AbortController is aborted', async () => {
    const ac = new AbortController();
    const promise = adapter.execute({
      cmd: ['node', '-e', 'setInterval(() => {}, 1000);'],
      ac,
    });
    setTimeout(() => ac.abort(), 50);

    const result = await promise;
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.timeMs).lessThan(1000);
      expect(result.abortReason).toBe(AbortReason.UserAbort);
    }
  });

  it('should allow manual process control via handle in spawn mode', async () => {
    const handle = await adapter.spawn({
      cmd: [
        'node',
        '-e',
        `process.stdin.on('data', (d) => console.log('got:' + d));`,
      ],
    });
    expect(handle.pid).toBeGreaterThan(0);

    handle.writeStdin('manual_input');
    handle.closeStdin();

    const result = await handle.wait();
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe(0);
      expect(readFileSync(result.stdoutPath, 'utf-8').trim()).toBe(
        'got:manual_input',
      );
    }
  });

  it('should allow manual process control via handle in spawn mode', async () => {
    const handle = await adapter.spawn({
      cmd: [
        'node',
        '-e',
        `process.stdin.on('data', (d) => console.log('got:' + d));`,
      ],
    });
    expect(handle.pid).toBeGreaterThan(0);

    handle.kill();

    const result = await handle.wait();
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.codeOrSignal).toBe('SIGTERM');
    }
  });

  it('should return error if the program does not exists', async () => {
    const result = await adapter.execute({
      cmd: ['non_exists'],
    });
    expect(result).toBeInstanceOf(Error);
  });
});

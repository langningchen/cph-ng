import { cryptoMock } from '@t/infrastructure/node/cryptoMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKENS } from '@/composition/tokens';
import { StressTestState } from '@/domain/entities/stressTest';
import { ProblemMigrationService } from '@/infrastructure/problems/problemMigrationService';

describe('ProblemMigrationService', () => {
  let migration: ProblemMigrationService;

  beforeEach(() => {
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.crypto, cryptoMock);
    migration = container.resolve(ProblemMigrationService);
  });

  it('should return latest version data as-is', () => {
    const data = {
      version: '0.6.0',
      name: 'test',
      testcases: {},
      testcaseOrder: [],
      src: { path: '/src/main.cpp' },
      checker: null,
      interactor: null,
      stressTest: {
        generator: null,
        bruteForce: null,
        cnt: 0,
        state: StressTestState.inactive,
      },
      timeElapsedMs: 0,
      overrides: {},
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
    expect(result.name).toBe('test');
  });

  it('should migrate from 0.4.8 to 0.6.0', () => {
    const data = {
      version: '0.4.8',
      name: 'migrated',
      url: 'https://cf.com/1/A',
      src: { path: '/src/code.cpp' },
      checker: null,
      interactor: null,
      bfCompare: {
        generator: { path: '/gen.cpp' },
        bruteForce: { path: '/bf.cpp' },
      },
      tcs: {
        'tc-0': {
          stdin: { useFile: false, data: 'hello' },
          answer: { useFile: true, data: '/tmp/answer.txt' },
          isExpand: false,
          isDisabled: false,
          result: null,
        },
      },
      tcOrder: ['tc-0'],
      timeElapsed: 100,
      timeLimit: 2000,
      memoryLimit: 256,
      compilationSettings: {
        compiler: 'g++',
        compilerArgs: '-O2',
      },
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
    expect(result.name).toBe('migrated');
    expect(result.testcaseOrder).toEqual(['tc-0']);
    expect(result.testcases['tc-0'].stdin).toEqual({ data: 'hello' });
    expect(result.testcases['tc-0'].answer).toEqual({ path: '/tmp/answer.txt' });
    expect(result.stressTest.generator).toEqual({ path: '/gen.cpp' });
    expect(result.stressTest.state).toBe(StressTestState.inactive);
    expect(result.overrides.timeLimitMs).toBe(2000);
    expect(result.overrides.compiler).toBe('g++');
    expect(result.timeElapsedMs).toBe(100);
  });

  it('should migrate from 0.4.3 to 0.4.8 (handle old IO format)', () => {
    const data = {
      version: '0.4.3',
      name: 'old-io',
      src: { path: '/src/code.cpp' },
      checker: null,
      interactor: null,
      tcs: {
        'tc-0': {
          stdin: { useFile: false, data: 'input', path: '' },
          answer: { useFile: true, data: '', path: '/tmp/ans.txt' },
          isExpand: false,
          isDisabled: true,
          result: undefined,
        },
      },
      tcOrder: ['tc-0'],
      timeElapsed: 0,
      timeLimit: 1000,
      memoryLimit: 512,
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
    expect(result.testcases['tc-0'].stdin).toEqual({ data: 'input' });
    expect(result.testcases['tc-0'].answer).toEqual({ path: '/tmp/ans.txt' });
  });

  it('should migrate from 0.3.7 (add isDisabled)', () => {
    const data = {
      version: '0.3.7',
      name: 'no-disabled',
      src: { path: '/src/code.cpp' },
      checker: null,
      interactor: null,
      tcs: {
        'tc-0': {
          stdin: { useFile: false, data: 'input', path: '' },
          answer: { useFile: false, data: 'ans', path: '' },
          isExpand: false,
          result: undefined,
        },
      },
      tcOrder: ['tc-0'],
      timeElapsed: 0,
      timeLimit: 1000,
      memoryLimit: 512,
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
  });

  it('should migrate from 0.2.4 (array tcs to map)', () => {
    const data = {
      version: '0.2.4',
      name: 'array-tcs',
      src: { path: '/src/code.cpp' },
      checker: null,
      interactor: null,
      tcs: [
        {
          stdin: { useFile: false, data: 'in1', path: '' },
          answer: { useFile: false, data: 'out1', path: '' },
          isExpand: false,
          result: undefined,
        },
      ],
      timeElapsed: 0,
      timeLimit: 1000,
      memoryLimit: 512,
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
    expect(result.testcaseOrder).toHaveLength(1);
  });

  it('should migrate from 0.0.5 (srcPath/srcHash to src)', () => {
    const data = {
      version: '0.0.5',
      name: 'legacy',
      srcPath: '/src/code.cpp',
      srcHash: 'abc123',
      isSpecialJudge: true,
      checkerPath: '/checker.cpp',
      checkerHash: 'def456',
      tcs: [],
      timeElapsed: 0,
      timeLimit: 1000,
      memoryLimit: 512,
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
  });

  it('should detect version from structure when no version field (has src)', () => {
    const data = {
      name: 'no-version',
      src: { path: '/src/code.cpp' },
      tcs: [],
    };

    const result = migration.migrate(data);
    expect(result.version).toBe('0.6.0');
  });
});

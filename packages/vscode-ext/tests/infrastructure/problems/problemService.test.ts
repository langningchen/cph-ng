import type { IProblem, TestcaseId } from '@cph-ng/core';
import { StressTestState, VerdictName } from '@cph-ng/core';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { telemetryMock } from '@t/infrastructure/vscode/telemetryMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { describe, expect, it, vi } from 'vitest';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IProblemMigrationService } from '@/application/ports/problems/IProblemMigrationService';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { IUi } from '@/application/ports/vscode/IUi';
import { Problem } from '@/domain/entities/problem';
import { StressTest } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import type { TestcaseScanner } from '@/domain/services/TestcaseScanner';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { ProblemMapper } from '@/infrastructure/problems/problemMapper';
import { ProblemService } from '@/infrastructure/problems/problemService';

describe('ProblemService', () => {
  const createService = () => {
    const { fileSystemMock } = createFileSystemMock();
    const path = new PathAdapter();
    const resolver = mock<IPathResolver>();
    resolver.renderPathWithFile.mockImplementation((original, filePath) => {
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      if (original === settingsMock.problem.testcaseFilePath)
        return `/data/${baseName}.\${id}.\${ext}`;
      return `/data/${baseName}.bin`;
    });
    resolver.renderString.mockImplementation((original, replacements) => {
      let result = original;
      for (const [key, value] of replacements) result = result.replaceAll(`\${${key}}`, value);
      return result;
    });
    resolver.renderPath.mockImplementation((original) => original);

    const tempStorage = mock<ITempStorage>();
    tempStorage.dispose.mockImplementation(() => {});
    const migration = mock<IProblemMigrationService>();
    migration.migrate.mockImplementation((raw) => raw as unknown as IProblem);

    const service = new ProblemService(
      mock<ICrypto>(),
      fileSystemMock,
      loggerMock,
      path,
      resolver,
      settingsMock,
      telemetryMock,
      tempStorage,
      migration,
      translatorMock,
      mock<IUi>(),
      new ProblemMapper('1.0.0'),
      mock<TestcaseScanner>(),
    );

    return { fileSystemMock, service };
  };

  describe('copy', () => {
    it('copies source, testcase files, custom files, and problem data independently', async () => {
      const { fileSystemMock, service } = createService();
      const testcaseId = '12345678-aaaa' as TestcaseId;
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.in', 'input');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.ans', 'answer');
      await fileSystemMock.safeWriteFile('/tools/checker.cpp', 'checker');
      await fileSystemMock.safeWriteFile('/tools/interactor.cpp', 'interactor');
      await fileSystemMock.safeWriteFile('/tools/gen.cpp', 'generator');
      await fileSystemMock.safeWriteFile('/tools/brute.cpp', 'brute');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      const testcase = new Testcase(
        new TestcaseIo({ path: '/data/1841D.12345678.in' }),
        new TestcaseIo({ path: '/data/1841D.12345678.ans' }),
      );
      testcase.updateResult({
        verdict: VerdictName.accepted,
        timeMs: 1,
        memoryMb: 2,
        stdout: new TestcaseIo({ path: '/tmp/stdout' }),
        stderr: null,
        msg: 'ok',
      });
      problem.addTestcase(testcaseId, testcase);
      problem.checker = { path: '/tools/checker.cpp', hash: 'checker-hash' };
      problem.interactor = { path: '/tools/interactor.cpp', hash: 'interactor-hash' };
      problem.stressTest = new StressTest(
        { path: '/tools/gen.cpp', hash: 'gen-hash' },
        { path: '/tools/brute.cpp', hash: 'brute-hash' },
        3,
        StressTestState.inactive,
      );

      const copied = await service.copy(problem, '/src/1841D_brute.cpp');

      expect(await fileSystemMock.readFile('/src/1841D_brute.cpp')).toBe('source');
      expect(await fileSystemMock.readFile('/data/1841D_brute.12345678.in')).toBe('input');
      expect(await fileSystemMock.readFile('/data/1841D_brute.12345678.ans')).toBe('answer');
      expect(await fileSystemMock.readFile('/data/1841D_brute.checker.cpp')).toBe('checker');
      expect(await fileSystemMock.readFile('/data/1841D_brute.interactor.cpp')).toBe('interactor');
      expect(await fileSystemMock.readFile('/data/1841D_brute.generator.cpp')).toBe('generator');
      expect(await fileSystemMock.readFile('/data/1841D_brute.bruteForce.cpp')).toBe('brute');

      const copiedTestcase = copied.getTestcase(testcaseId);
      expect(copiedTestcase.stdin.path).toBe('/data/1841D_brute.12345678.in');
      expect(copiedTestcase.answer.path).toBe('/data/1841D_brute.12345678.ans');
      expect(copiedTestcase.result).toBeNull();
      expect(copied.checker).toEqual({
        path: '/data/1841D_brute.checker.cpp',
        hash: 'checker-hash',
      });
      expect(copied.interactor).toEqual({
        path: '/data/1841D_brute.interactor.cpp',
        hash: 'interactor-hash',
      });
      expect(copied.stressTest.generator).toEqual({
        path: '/data/1841D_brute.generator.cpp',
        hash: 'gen-hash',
      });
      expect(copied.stressTest.bruteForce).toEqual({
        path: '/data/1841D_brute.bruteForce.cpp',
        hash: 'brute-hash',
      });
    });

    it('rolls back copied files when saving the copied problem fails', async () => {
      const { fileSystemMock, service } = createService();
      const testcaseId = '12345678-aaaa' as TestcaseId;
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.in', 'input');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.out', 'answer');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      problem.addTestcase(
        testcaseId,
        new Testcase(
          new TestcaseIo({ path: '/data/1841D.12345678.in' }),
          new TestcaseIo({ path: '/data/1841D.12345678.out' }),
        ),
      );
      vi.spyOn(service, 'save').mockRejectedValueOnce(new Error('save failed'));

      await expect(service.copy(problem, '/src/1841D_brute.cpp')).rejects.toThrow('save failed');

      await expect(fileSystemMock.exists('/src/1841D_brute.cpp')).resolves.toBe(false);
      await expect(fileSystemMock.exists('/data/1841D_brute.12345678.in')).resolves.toBe(false);
      await expect(fileSystemMock.exists('/data/1841D_brute.12345678.out')).resolves.toBe(false);
    });
  });
});

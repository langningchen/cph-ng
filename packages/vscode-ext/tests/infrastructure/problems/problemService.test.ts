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

      const originalTestcase = problem.getTestcase(testcaseId);
      expect(originalTestcase.stdin.path).toBe('/data/1841D.12345678.in');
      expect(originalTestcase.answer.path).toBe('/data/1841D.12345678.ans');
      expect(originalTestcase.result?.verdict).toBe(VerdictName.accepted);
      expect(problem.checker?.path).toBe('/tools/checker.cpp');
      expect(problem.interactor?.path).toBe('/tools/interactor.cpp');
      expect(problem.stressTest.generator?.path).toBe('/tools/gen.cpp');
      expect(problem.stressTest.bruteForce?.path).toBe('/tools/brute.cpp');
    });

    it('copies inline testcase data without creating testcase files', async () => {
      const { fileSystemMock, service } = createService();
      const testcaseId = '12345678-aaaa' as TestcaseId;
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      problem.addTestcase(
        testcaseId,
        new Testcase(
          new TestcaseIo({ data: '2\n1 2\n' }),
          new TestcaseIo({ data: '3\n' }),
          true,
          true,
        ),
      );

      const copied = await service.copy(problem, '/src/1841D_brute.cpp');

      expect(await fileSystemMock.readFile('/src/1841D_brute.cpp')).toBe('source');
      await expect(fileSystemMock.exists('/data/1841D_brute.12345678.in')).resolves.toBe(false);
      await expect(fileSystemMock.exists('/data/1841D_brute.12345678.out')).resolves.toBe(false);

      const copiedTestcase = copied.getTestcase(testcaseId);
      expect(copiedTestcase.stdin.data).toBe('2\n1 2\n');
      expect(copiedTestcase.answer.data).toBe('3\n');
      expect(copiedTestcase.isExpand).toBe(true);
      expect(copiedTestcase.isDisabled).toBe(true);
      expect(copied.checker).toBeNull();
      expect(copied.interactor).toBeNull();
      expect(copied.stressTest.generator).toBeNull();
      expect(copied.stressTest.bruteForce).toBeNull();
    });

    it('uses fallback testcase extensions when source testcase files have no extension', async () => {
      const { fileSystemMock, service } = createService();
      const testcaseId = '12345678-aaaa' as TestcaseId;
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/data/input-file', 'input');
      await fileSystemMock.safeWriteFile('/data/answer-file', 'answer');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      problem.addTestcase(
        testcaseId,
        new Testcase(
          new TestcaseIo({ path: '/data/input-file' }),
          new TestcaseIo({ path: '/data/answer-file' }),
        ),
      );

      const copied = await service.copy(problem, '/src/1841D_brute.cpp');

      expect(await fileSystemMock.readFile('/data/1841D_brute.12345678.in')).toBe('input');
      expect(await fileSystemMock.readFile('/data/1841D_brute.12345678.out')).toBe('answer');

      const copiedTestcase = copied.getTestcase(testcaseId);
      expect(copiedTestcase.stdin.path).toBe('/data/1841D_brute.12345678.in');
      expect(copiedTestcase.answer.path).toBe('/data/1841D_brute.12345678.out');
    });

    it('does not copy anything when the copied problem data path already exists', async () => {
      const { fileSystemMock, service } = createService();
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/data/1841D_brute.bin', 'occupied');

      const problem = new Problem('1841D', '/src/1841D.cpp');

      await expect(service.copy(problem, '/src/1841D_brute.cpp')).rejects.toThrow(
        'Copied problem data path already exists',
      );

      await expect(fileSystemMock.exists('/src/1841D_brute.cpp')).resolves.toBe(false);
      expect(await fileSystemMock.readFile('/data/1841D_brute.bin')).toBe('occupied');
      expect(fileSystemMock.copyFile).not.toHaveBeenCalled();
    });

    it('rolls back the copied source when a testcase destination already exists', async () => {
      const { fileSystemMock, service } = createService();
      const testcaseId = '12345678-aaaa' as TestcaseId;
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.in', 'input');
      await fileSystemMock.safeWriteFile('/data/1841D.12345678.out', 'answer');
      await fileSystemMock.safeWriteFile('/data/1841D_brute.12345678.in', 'occupied');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      problem.addTestcase(
        testcaseId,
        new Testcase(
          new TestcaseIo({ path: '/data/1841D.12345678.in' }),
          new TestcaseIo({ path: '/data/1841D.12345678.out' }),
        ),
      );

      await expect(service.copy(problem, '/src/1841D_brute.cpp')).rejects.toThrow(
        'Copied problem file path already exists',
      );

      await expect(fileSystemMock.exists('/src/1841D_brute.cpp')).resolves.toBe(false);
      expect(await fileSystemMock.readFile('/data/1841D_brute.12345678.in')).toBe('occupied');
      await expect(fileSystemMock.exists('/data/1841D_brute.12345678.out')).resolves.toBe(false);
    });

    it('rolls back already copied auxiliary files when a later auxiliary path conflicts', async () => {
      const { fileSystemMock, service } = createService();
      await fileSystemMock.safeWriteFile('/src/1841D.cpp', 'source');
      await fileSystemMock.safeWriteFile('/tools/checker.cpp', 'checker');
      await fileSystemMock.safeWriteFile('/tools/interactor.cpp', 'interactor');
      await fileSystemMock.safeWriteFile('/data/1841D_brute.interactor.cpp', 'occupied');

      const problem = new Problem('1841D', '/src/1841D.cpp');
      problem.checker = { path: '/tools/checker.cpp', hash: 'checker-hash' };
      problem.interactor = { path: '/tools/interactor.cpp', hash: 'interactor-hash' };

      await expect(service.copy(problem, '/src/1841D_brute.cpp')).rejects.toThrow(
        'Copied problem file path already exists',
      );

      await expect(fileSystemMock.exists('/src/1841D_brute.cpp')).resolves.toBe(false);
      await expect(fileSystemMock.exists('/data/1841D_brute.checker.cpp')).resolves.toBe(false);
      expect(await fileSystemMock.readFile('/data/1841D_brute.interactor.cpp')).toBe('occupied');
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

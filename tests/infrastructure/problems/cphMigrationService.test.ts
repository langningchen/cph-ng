import { cryptoMock } from '@t/infrastructure/node/cryptoMock';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { TOKENS } from '@/composition/tokens';
import { CphMigrationService } from '@/infrastructure/problems/cphMigrationService';

describe('CphMigrationService', () => {
  let service: CphMigrationService;
  let fileSystemMock: MockProxy<IFileSystem>;

  beforeEach(() => {
    ({ fileSystemMock } = createFileSystemMock());
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.crypto, cryptoMock);
    container.registerInstance(TOKENS.path, pathMock);
    service = container.resolve(CphMigrationService);
  });

  describe('canMigrate', () => {
    it('should return true when .prob file exists', async () => {
      const srcPath = '/workspace/main.cpp';
      const hash = cryptoMock.md5(srcPath);
      const probPath = `/workspace/.cph/.main.cpp_${hash}.prob`;
      await fileSystemMock.safeWriteFile(probPath, '{}');

      const result = await service.canMigrate(srcPath);
      expect(result).toBe(true);
    });

    it('should return false when .prob file does not exist', async () => {
      const result = await service.canMigrate('/workspace/main.cpp');
      expect(result).toBe(false);
    });
  });

  describe('migrateFromSource', () => {
    it('should return undefined when no .prob file', async () => {
      const result = await service.migrateFromSource('/workspace/main.cpp');
      expect(result).toBeUndefined();
    });

    it('should convert CPH problem to domain Problem', async () => {
      const srcPath = '/workspace/main.cpp';
      const hash = cryptoMock.md5(srcPath);
      const probPath = `/workspace/.cph/.main.cpp_${hash}.prob`;

      const cphProblem = {
        name: 'A + B Problem',
        url: 'https://cf.com/1/A',
        srcPath: '/workspace/main.cpp',
        group: 'CF',
        local: false,
        interactive: false,
        memoryLimit: 256,
        timeLimit: 2000,
        tests: [
          { id: 1, input: '1 2', output: '3' },
          { id: 2, input: '5 7', output: '12' },
        ],
      };
      await fileSystemMock.safeWriteFile(probPath, JSON.stringify(cphProblem));

      const result = await service.migrateFromSource(srcPath);
      expect(result).toBeDefined();
      expect(result?.name).toBe('A + B Problem');
      expect(result?.url).toBe('https://cf.com/1/A');
      expect(result?.overrides.timeLimitMs).toBe(2000);
      expect(result?.overrides.memoryLimitMb).toBe(256);
      expect(result?.testcaseOrder).toHaveLength(2);
    });

    it('should return undefined for invalid JSON', async () => {
      const srcPath = '/workspace/main.cpp';
      const hash = cryptoMock.md5(srcPath);
      const probPath = `/workspace/.cph/.main.cpp_${hash}.prob`;
      await fileSystemMock.safeWriteFile(probPath, 'invalid json');

      const result = await service.migrateFromSource(srcPath);
      expect(result).toBeUndefined();
    });
  });

  describe('migrateFolder', () => {
    it('should migrate all .prob files in folder', async () => {
      const cphProblem = {
        name: 'Test',
        url: '',
        srcPath: '/ws/code.cpp',
        group: '',
        local: false,
        interactive: false,
        memoryLimit: 256,
        timeLimit: 1000,
        tests: [{ id: 1, input: '1', output: '2' }],
      };
      await fileSystemMock.safeWriteFile('/folder/a.prob', JSON.stringify(cphProblem));
      await fileSystemMock.safeWriteFile(
        '/folder/b.prob',
        JSON.stringify({ ...cphProblem, name: 'Test2' }),
      );
      await fileSystemMock.safeWriteFile('/folder/readme.txt', 'not a prob');

      fileSystemMock.readdir.mockResolvedValueOnce(['a.prob', 'b.prob', 'readme.txt']);

      const results = await service.migrateFolder('/folder');
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Test');
      expect(results[1].name).toBe('Test2');
    });
  });
});

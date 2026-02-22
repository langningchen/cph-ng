import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { TempStorageMock } from '@t/infrastructure/node/tempStorageMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import { TOKENS } from '@/composition/tokens';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { TestcaseIoService } from '@/infrastructure/problems/testcaseIoService';

describe('TestcaseIoService', () => {
  let service: TestcaseIoService;
  let fileSystemMock: MockProxy<IFileSystem>;
  let tempStorageMock: TempStorageMock;

  beforeEach(() => {
    ({ fileSystemMock } = createFileSystemMock());
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerSingleton(TOKENS.tempStorage, TempStorageMock);

    service = container.resolve(TestcaseIoService);
    tempStorageMock = container.resolve(TOKENS.tempStorage) as TempStorageMock;
  });

  describe('readContent', () => {
    it('should read content from file when IO has path', async () => {
      await fileSystemMock.safeWriteFile('/tmp/data.txt', 'file content');
      const io = new TestcaseIo({ path: '/tmp/data.txt' });

      const result = await service.readContent(io);
      expect(result).toBe('file content');
    });

    it('should return data directly when IO has data', async () => {
      const io = new TestcaseIo({ data: 'inline content' });
      const result = await service.readContent(io);
      expect(result).toBe('inline content');
    });
  });

  describe('writeContent', () => {
    it('should write to file when IO has path', async () => {
      await fileSystemMock.safeWriteFile('/tmp/data.txt', 'old');
      const io = new TestcaseIo({ path: '/tmp/data.txt' });

      const result = await service.writeContent(io, 'new content');
      expect(result.path).toBe('/tmp/data.txt');

      const written = await fileSystemMock.readFile('/tmp/data.txt');
      expect(written).toBe('new content');
    });

    it('should return new data IO when IO has data', async () => {
      const io = new TestcaseIo({ data: 'old' });
      const result = await service.writeContent(io, 'new content');
      expect(result.data).toBe('new content');
    });
  });

  describe('ensureFilePath', () => {
    it('should return existing path when IO has path', async () => {
      const io = new TestcaseIo({ path: '/tmp/existing.txt' });
      const result = await service.ensureFilePath(io);
      expect(result.path).toBe('/tmp/existing.txt');
      expect(result.needDispose).toBe(false);
    });

    it('should create temp file when IO has data', async () => {
      const io = new TestcaseIo({ data: 'content to write' });
      const result = await service.ensureFilePath(io);

      expect(result.needDispose).toBe(true);
      expect(result.path).toBeTruthy();

      const written = await fileSystemMock.readFile(result.path);
      expect(written).toBe('content to write');

      tempStorageMock.checkFile([result.path]);
    });
  });

  describe('tryInlining', () => {
    it('should inline small files', async () => {
      await fileSystemMock.safeWriteFile('/tmp/small.txt', 'small');
      const io = new TestcaseIo({ path: '/tmp/small.txt' });

      const result = await service.tryInlining(io);
      expect(result.data).toBe('small');
      expect(result.path).toBeUndefined();
    });

    it('should keep path for large files', async () => {
      const largeContent = 'x'.repeat(settingsMock.problem.maxInlineDataLength + 1);
      await fileSystemMock.safeWriteFile('/tmp/large.txt', largeContent);
      const io = new TestcaseIo({ path: '/tmp/large.txt' });

      const result = await service.tryInlining(io);
      expect(result.path).toBe('/tmp/large.txt');
      expect(result.data).toBeUndefined();
    });

    it('should return data IO as-is', async () => {
      const io = new TestcaseIo({ data: 'inline' });
      const result = await service.tryInlining(io);
      expect(result.data).toBe('inline');
    });
  });

  describe('dispose', () => {
    it('should dispose path-based IO', async () => {
      const path = tempStorageMock.create('test');
      const io = new TestcaseIo({ path });
      await service.dispose(io);
      tempStorageMock.checkFile();
    });

    it('should be no-op for data-based IO', async () => {
      const io = new TestcaseIo({ data: 'content' });
      await service.dispose(io);
      tempStorageMock.checkFile();
    });
  });
});

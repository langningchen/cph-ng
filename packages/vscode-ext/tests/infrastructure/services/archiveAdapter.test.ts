import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { ArchiveAdapter } from '@/infrastructure/services/archiveAdapter';

describe('ArchiveAdapter', () => {
  it('extracts to a new directory and preserves an occupied destination', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-archive-'));
    try {
      const zipPath = join(root, 'tests.zip');
      const destination = join(root, 'nested', 'tests');
      const zip = new AdmZip();
      zip.addFile('one.in', Buffer.from('input'));
      zip.writeZip(zipPath);
      const archive = new ArchiveAdapter(new FileSystemAdapter(new PathAdapter()));
      await archive.unzip(zipPath, destination);
      expect(await readFile(join(destination, 'one.in'), 'utf8')).toBe('input');
      await writeFile(join(destination, 'one.in'), 'user data');
      await expect(archive.unzip(zipPath, destination)).rejects.toMatchObject({ code: 'EEXIST' });
      expect(await readFile(join(destination, 'one.in'), 'utf8')).toBe('user data');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('removes only its new directory when extraction fails partway through', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cph-archive-'));
    try {
      const zipPath = join(root, 'tests.zip');
      const destination = join(root, 'tests');
      const zip = new AdmZip();
      zip.addFile('one', Buffer.from('partial'));
      zip.addFile('one/two', Buffer.from('cannot extract inside a file'));
      zip.writeZip(zipPath);
      await mkdir(join(root, 'existing'));
      await writeFile(join(root, 'existing', 'keep'), 'keep');
      const archive = new ArchiveAdapter(new FileSystemAdapter(new PathAdapter()));
      await expect(archive.unzip(zipPath, destination)).rejects.toThrow();
      await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(root, 'existing', 'keep'), 'utf8')).toBe('keep');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

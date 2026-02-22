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

import { dirname } from 'node:path';
import { mock } from '@t/mock';
import { createFsFromVolume, Volume } from 'memfs';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';

export function createFileSystemMock(vol: InstanceType<typeof Volume> = new Volume()) {
  const fs = createFsFromVolume(vol);
  const fileSystemMock = mock<IFileSystem>();
  fileSystemMock.readRawFile.mockImplementation(async (path) => {
    const result = await fs.promises.readFile(path);
    return Buffer.from(result);
  });
  fileSystemMock.readFile.mockImplementation(async (path, encoding = 'utf8') => {
    const result = await fs.promises.readFile(path, { encoding });
    return result as string;
  });
  fileSystemMock.safeWriteFile.mockImplementation(async (path, data) => {
    await fs.promises.mkdir(dirname(path), { recursive: true });
    await fs.promises.writeFile(path, data);
  });
  fileSystemMock.safeCreateFile.mockImplementation((path) => {
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(path, '');
  });
  fileSystemMock.exists.mockImplementation(async (path) => {
    try {
      await fs.promises.access(path);
      return true;
    } catch {
      return false;
    }
  });
  fileSystemMock.existsSync.mockImplementation((path) => {
    try {
      fs.accessSync(path);
      return true;
    } catch {
      return false;
    }
  });
  fileSystemMock.mkdir.mockImplementation(async (path) => {
    await fs.promises.mkdir(path, { recursive: true });
  });
  fileSystemMock.readdir.mockImplementation(async (path) => {
    const result = await fs.promises.readdir(path, { encoding: 'utf8' });
    return result as string[];
  });
  fileSystemMock.stat.mockImplementation(async (path) => {
    const stats = await fs.promises.stat(path);
    return {
      size: stats.size as number,
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
    };
  });
  fileSystemMock.rm.mockImplementation(async (path, options?) => {
    await fs.promises.rm(path, options);
  });
  fileSystemMock.walk.mockImplementation(async (path) => {
    const result = await fs.promises.readdir(path, { encoding: 'utf8', recursive: true });
    return result as string[];
  });
  fileSystemMock.createReadStream.mockImplementation((path) => {
    return fs.createReadStream(path);
  });
  fileSystemMock.safeCreateWriteStream.mockImplementation((path) => {
    fs.mkdirSync(dirname(path), { recursive: true });
    return fs.createWriteStream(path);
  });

  return { fileSystemMock, vol };
}

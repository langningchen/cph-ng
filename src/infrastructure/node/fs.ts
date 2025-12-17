import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { IFileSystem } from '@/application/ports/IFileSystem';

export class NodeFsAdapter implements IFileSystem {
  async readFile(
    path: string,
    encoding: BufferEncoding = 'utf8',
  ): Promise<string> {
    return readFile(path, { encoding });
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await readFile(path, { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }

  async mkdirp(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    await rm(path, { recursive: options?.recursive, force: options?.force });
  }
}

export default NodeFsAdapter;

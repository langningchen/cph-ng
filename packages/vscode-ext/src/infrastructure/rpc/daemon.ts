import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { chmod, lstat, mkdir, realpath } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { type ClientOptions, KernelRpcClient, RpcRemoteError } from './client';

/** The endpoint depends on the canonical store, so all editor windows share its owner. */
export async function kernelEndpoint(storeRoot: string): Promise<string> {
  const canonical = await realpath(storeRoot);
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 20);
  if (process.platform === 'win32') return `\\\\.\\pipe\\cph-ng-judge-${hash}`;
  const uid = userInfo().uid;
  // macOS's per-process temp path can exceed sockaddr_un's small path budget.
  const base = process.platform === 'darwin' ? '/tmp' : tmpdir();
  const directory = join(base, `cph-ng-${uid}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== uid)
    throw new Error('Judge kernel endpoint directory is not owned by the current user');
  await chmod(directory, 0o700);
  const endpoint = join(directory, `${hash}.sock`);
  if (Buffer.byteLength(endpoint) >= 104)
    throw new Error('Judge kernel socket path is too long; set a shorter TMPDIR');
  return endpoint;
}

export async function connectSharedKernel(
  command: string,
  storeRoot: string,
  workspaceRoots: string[],
  log: (message: string) => void,
): Promise<KernelRpcClient> {
  await mkdir(storeRoot, { recursive: true });
  const endpoint = await kernelEndpoint(storeRoot);
  const connect = async () => {
    const options: ClientOptions = {
      command,
      args: [],
      endpoint,
      workspaceRoots: [...workspaceRoots],
      startupTimeoutMs: 1500,
      log,
    };
    const client = new KernelRpcClient(options);
    try {
      await client.connect();
      options.ensureServer = async () => {
        const recovered = await connectSharedKernel(
          command,
          storeRoot,
          options.workspaceRoots ?? [],
          log,
        );
        await recovered.dispose();
      };
      return client;
    } catch (error) {
      await client.dispose();
      throw error;
    }
  };
  try {
    return await connect();
  } catch (error) {
    if (error instanceof RpcRemoteError) throw error;
  }
  const logPath = join(storeRoot, 'kernel.log');
  const fd = openSync(logPath, 'a', 0o600);
  try {
    const args = ['serve', '--store-root', storeRoot, '--transport'];
    args.push(...(process.platform === 'win32' ? ['pipe', '--pipe'] : ['unix', '--socket']));
    args.push(endpoint);
    const child = spawn(command, args, {
      detached: true,
      stdio: ['ignore', 'ignore', fd],
      windowsHide: true,
      shell: false,
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
  } finally {
    closeSync(fd);
  }
  log(`Connecting to shared judge kernel at ${endpoint}; server log: ${logPath}\n`);
  const deadline = Date.now() + 10_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await connect();
    } catch (error) {
      if (error instanceof RpcRemoteError) throw error;
      lastError = error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Cannot connect to judge kernel. See ${logPath}: ${String(lastError)}`);
}

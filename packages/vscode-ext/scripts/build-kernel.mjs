import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extension = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(extension, '../..');
// CI supplies every native binary; preserve the original runner's ABI baseline.
if (process.env.CPH_NG_KERNEL_PREBUILT === '1') {
  for (const platform of ['linux-x64', 'linux-arm64', 'win32-x64', 'darwin-x64', 'darwin-arm64']) {
    const name = platform.startsWith('win32-') ? 'cph-ng-judge.exe' : 'cph-ng-judge';
    const binary = join(extension, 'bin', platform, name);
    const info = statSync(binary);
    if (!info.isFile() || info.size === 0) {
      throw new Error(`Missing or empty native kernel: ${binary}`);
    }
  }
  console.log('Using all five prebuilt native kernels.');
  process.exit(0);
}

const targetDir = join(root, 'target');
execFileSync(
  'cargo',
  ['build', '--release', '--locked', '-p', 'cph-ng-judge', '--target-dir', targetDir],
  { cwd: join(root, 'packages/judge-kernel'), stdio: 'inherit' },
);
const name = process.platform === 'win32' ? 'cph-ng-judge.exe' : 'cph-ng-judge';
const destination = join(extension, 'bin', `${process.platform}-${process.arch}`);
mkdirSync(destination, { recursive: true });
copyFileSync(join(targetDir, 'release', name), join(destination, name));

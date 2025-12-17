import { spawn } from 'child_process';
import { once } from 'events';
import type {
  IProcessRunner,
  ProcessRunOptions,
  ProcessRunResult,
} from '@/application/ports/IProcessRunner';

export class ChildProcessRunner implements IProcessRunner {
  async run(
    cmd: string,
    args: string[],
    opts: ProcessRunOptions = {},
  ): Promise<ProcessRunResult> {
    const start = Date.now();
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (opts.stdin) {
      child.stdin.write(opts.stdin);
    }
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = opts.timeoutMs
      ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs)
      : null;

    const [code] = (await once(child, 'exit')) as [number | null];
    if (timeout) {
      clearTimeout(timeout);
    }

    return {
      stdout,
      stderr,
      exitCode: code ?? -1,
      timeMs: Date.now() - start,
    } satisfies ProcessRunResult;
  }
}

export default ChildProcessRunner;

export interface ProcessRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  memLimitMb?: number;
  stdin?: string;
  tag?: string;
}

export interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  maxRssMb?: number;
}

export interface IProcessRunner {
  run(
    cmd: string,
    args: string[],
    opts?: ProcessRunOptions,
  ): Promise<ProcessRunResult>;
  killByTag?(tag: string): Promise<void>;
}
export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  memLimitMb?: number;
  stdin?: string;
  tag?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  maxRssMb?: number;
}

export interface IProcessRunner {
  run(cmd: string, args: string[], opts: RunOptions): Promise<RunResult>;
  killByTag?(tag: string): Promise<void>;
}

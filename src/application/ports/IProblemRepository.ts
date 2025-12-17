import type { Problem } from '@/types';

export interface TcExecutionArtifacts {
  stdout: string;
  stderr: string;
  timeMs: number;
  memoryMb?: number;
}

export interface IProblemRepository {
  /**
   * In the current codebase, problemId corresponds to the source path.
   */
  getById(problemId: string): Promise<Problem | null>;
  updateTcResult(
    problemId: string,
    tcId: string,
    verdict: string,
    artifacts: TcExecutionArtifacts,
  ): Promise<void>;
  save(problem: Problem): Promise<void>;
}

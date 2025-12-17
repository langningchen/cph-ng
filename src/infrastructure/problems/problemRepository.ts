import type {
  IProblemRepository,
  TcExecutionArtifacts,
} from '@/application/ports/IProblemRepository';
import { Problem } from '@/types';

export class ProblemRepository implements IProblemRepository {
  async getById(problemId: string): Promise<Problem | null> {
    // Here problemId is the source path in current codebase.
    return (await Problem.fromSrc(problemId)) ?? null;
  }

  async updateTcResult(
    problemId: string,
    tcId: string,
    verdict: string,
    artifacts: TcExecutionArtifacts,
  ): Promise<void> {
    const problem = await Problem.fromSrc(problemId);
    if (!problem) {
      return;
    }
    const tc = problem.tcs[tcId as keyof typeof problem.tcs];
    if (!tc || !tc.result) {
      return;
    }
    tc.result.verdict.name = verdict;
    tc.result.time = artifacts.timeMs;
    tc.result.memory = artifacts.memoryMb;
    tc.result.stdout.data = artifacts.stdout;
    tc.result.stderr.data = artifacts.stderr;
    await problem.save();
  }

  async save(problem: Problem): Promise<void> {
    await problem.save();
  }
}

export default ProblemRepository;

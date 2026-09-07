// biome-ignore-all lint/style/useNamingConvention: JSON-RPC fields follow the Rust wire schema.
import { StressTestState, type TestcaseId, VerdictName } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { Problem } from '@/domain/entities/problem';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { RpcRemoteError, type TaskEvent } from './client';
import { KernelService } from './kernelService';
import { RpcProblemService } from './problemService';
import { rpcErrorCode, rpcMethod } from './protocol';

const verdicts: Record<string, VerdictName> = {
  accepted: VerdictName.accepted,
  wrong_answer: VerdictName.wrongAnswer,
  partially_correct: VerdictName.partiallyCorrect,
  presentation_error: VerdictName.presentationError,
  time_limit_exceeded: VerdictName.timeLimitExceed,
  memory_limit_exceeded: VerdictName.memoryLimitExceed,
  output_limit_exceeded: VerdictName.outputLimitExceed,
  runtime_error: VerdictName.runtimeError,
  rejected: VerdictName.rejected,
};
interface CaseResult {
  testcase_id: string;
  verdict: string;
  time_ms: number;
  memory_mb: number | null;
  stdout: string;
  stderr: string;
  message: string;
}
@injectable()
export class RpcJudgeService {
  public constructor(
    @inject(KernelService) private readonly kernel: KernelService,
    @inject(RpcProblemService) private readonly problems: RpcProblemService,
    @inject(TOKENS.document) private readonly document: IDocument,
  ) {}
  public async run(
    background: BackgroundProblem,
    testcaseId?: TestcaseId,
    stress = false,
  ): Promise<void> {
    const { problem } = background;
    const controller = new AbortController();
    background.ac = controller;
    let selected = testcaseId ? [testcaseId] : problem.getEnabledTestcaseIds();
    const update = (verdict: VerdictName, msg?: string) => {
      for (const id of selected) problem.getTestcase(id).updateResult({ verdict, msg });
    };
    try {
      await this.document.save(problem.src.path);
      const reference = await this.problems.reference(problem);
      const client = await this.kernel.forSource(problem.src.path);
      if (!stress && !testcaseId) selected = await this.problems.enabledTestcaseIds(problem);
      if (!stress && selected.length === 0) return;
      for (const id of selected) problem.getTestcase(id).clearResult();
      update(VerdictName.compiling);
      if (stress) {
        problem.stressTest.clearCnt();
        problem.stressTest.state = StressTestState.compiling;
      }
      const task = await client.runTask(
        stress
          ? rpcMethod.stressStart
          : testcaseId
            ? rpcMethod.testcaseRun
            : rpcMethod.testcaseRunAll,
        {
          ...reference,
          ...(testcaseId ? { testcase_id: testcaseId } : { testcase_ids: selected }),
        },
        controller.signal,
        (event) => this.progress(problem, event),
      );
      if (stress) {
        const result = task.result;
        if (result?.found_difference) {
          const testcase = new Testcase(
            new TestcaseIo({ data: String(result.input) }),
            new TestcaseIo({ data: String(result.answer) }),
            true,
          );
          problem.addTestcase(result.testcase_id as TestcaseId, testcase);
          if (result.result)
            this.result(problem, {
              ...(result.result as CaseResult),
              testcase_id: result.testcase_id as string,
            });
          problem.stressTest.state = StressTestState.foundDifference;
        } else problem.stressTest.state = StressTestState.inactive;
      } else
        for (const result of (task.result?.testcases ?? []) as CaseResult[])
          this.result(problem, result);
    } catch (error) {
      const code = error instanceof RpcRemoteError ? error.code : rpcErrorCode.internalError;
      const message = error instanceof Error ? error.message : String(error);
      const detail =
        error instanceof RpcRemoteError &&
        error.data &&
        typeof error.data === 'object' &&
        'stderr' in error.data
          ? String(error.data.stderr)
          : '';
      update(
        code === rpcErrorCode.compilationFailed
          ? VerdictName.compilationError
          : code === rpcErrorCode.taskState
            ? VerdictName.rejected
            : VerdictName.systemError,
        detail || message,
      );
      if (stress)
        problem.stressTest.state =
          code === rpcErrorCode.taskState
            ? StressTestState.inactive
            : code === rpcErrorCode.compilationFailed
              ? StressTestState.compilationError
              : StressTestState.internalError;
    } finally {
      background.abort();
    }
  }
  private progress(problem: Problem, event: TaskEvent): void {
    const result = event.result;
    if (result?.phase === 'running' && typeof result.testcase_id === 'string')
      problem
        .getTestcase(result.testcase_id as TestcaseId)
        .updateResult({ verdict: VerdictName.judging });
    if (result?.phase === 'testcase_finished') this.result(problem, result.testcase as CaseResult);
    if (result?.phase === 'stress_iteration') {
      problem.stressTest.count();
      problem.stressTest.state = StressTestState.runningSolution;
    }
  }
  private result(problem: Problem, result: CaseResult): void {
    const testcase = problem.testcases.get(result.testcase_id as TestcaseId);
    if (!testcase) return;
    testcase.updateResult({
      verdict: verdicts[result.verdict] ?? VerdictName.systemError,
      timeMs: result.time_ms,
      memoryMb: result.memory_mb,
      stdout: new TestcaseIo({ data: result.stdout }),
      stderr: new TestcaseIo({ data: result.stderr }),
      msg: result.message,
    });
  }
}

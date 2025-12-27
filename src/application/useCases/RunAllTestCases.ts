import type * as msgs from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { ISolutionRunner } from '@/application/ports/problems/ISolutionRunner';
import type { ICompilerService } from '@/application/ports/services/ICompilerService';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import { JudgeCoordinator } from '@/infrastructure/problems/judgeCoordinator';
import ProblemsManager from '@/modules/problems/manager';
import { isExpandVerdict, TcVerdicts, type TcWithResult } from '@/types';
import { TcResult } from '@/types/types.backend';
import { KnownResult } from '@/utils/result';

@injectable()
export class RunAllTestCases {
  constructor(
    @inject(TOKENS.CompilerService)
    private readonly compilerService: ICompilerService,
    @inject(TOKENS.SolutionRunner)
    private readonly solutionRunner: ISolutionRunner,
    @inject(JudgeCoordinator) private readonly judge: JudgeCoordinator,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
  ) {}

  async exec(msg: msgs.RunTcsMsg): Promise<void> {
    const fullProblem = await ProblemsManager.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }

    let ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    try {
      const tcs = fullProblem.problem.tcs;
      const tcOrder = [...fullProblem.problem.tcOrder].filter(
        (id) => !tcs[id].isDisabled,
      );
      const expandMemo: Record<string, boolean> = {};
      for (const tcId of tcOrder) {
        tcs[tcId].result?.dispose();
        tcs[tcId].result = new TcResult(TcVerdicts.CP);
        expandMemo[tcId] = tcs[tcId].isExpand;
        tcs[tcId].isExpand = false;
      }
      await ProblemsManager.dataRefresh();

      // Compile
      const compileResult = await this.compilerService.compileAll(
        fullProblem.problem,
        msg.compile,
        ac,
      );

      if (compileResult instanceof KnownResult) {
        for (const tcId of tcOrder) {
          tcs[tcId].result?.fromResult(compileResult);
        }
        return;
      }

      const compileData = compileResult.data;

      for (const tcId of tcOrder) {
        const result = tcs[tcId].result;
        if (result) {
          result.verdict = TcVerdicts.CPD;
        }
      }
      await ProblemsManager.dataRefresh();

      // Run
      const expandBehavior = this.settings.problem.expandBehavior;
      let hasAnyExpanded = false;

      for (const tcId of tcOrder) {
        const tc = tcs[tcId] as TcWithResult;
        if (!tc.result) {
          continue;
        }
        if (ac.signal.aborted) {
          if (ac.signal.reason === 'onlyOne') {
            ac = new AbortController();
            fullProblem.ac = ac;
          } else {
            tc.result.verdict = TcVerdicts.SK;
            continue;
          }
        }

        tc.result.verdict = TcVerdicts.JG;
        await ProblemsManager.dataRefresh();

        const runCommand = await compileData.srcLang.getRunCommand(
          compileData.src.outputPath,
          fullProblem.problem.compilationSettings,
        );

        const runRes = await this.solutionRunner.run(
          {
            cmd: runCommand,
            stdin: tc.stdin,
            timeLimitMs: fullProblem.problem.timeLimit,
            memoryLimitMb: fullProblem.problem.memoryLimit,
          },
          ac,
        );

        tc.result.verdict = TcVerdicts.JGD;

        const runOutcome = await this.judge.judge(
          {
            executionResult: runRes,
            inputPath: tc.stdin.toPath(),
            answerPath: tc.answer.toPath(),
            checkerPath: compileData.checker?.outputPath,
            timeLimitMs: fullProblem.problem.timeLimit,
            memoryLimitMb: fullProblem.problem.memoryLimit,
          },
          ac,
        );

        tc.result.verdict = VERDICTS[runOutcome.verdict];
        tc.result.time = runOutcome.timeMs;
        tc.result.memory = runOutcome.memoryMb;
        tc.result.msg = runOutcome.messages;

        // Expand logic
        if (expandBehavior === 'always') {
          tc.isExpand = true;
        } else if (expandBehavior === 'never') {
          tc.isExpand = false;
        } else if (expandBehavior === 'failed') {
          tc.isExpand = isExpandVerdict(tc.result.verdict);
        } else if (expandBehavior === 'first') {
          tc.isExpand = !hasAnyExpanded;
        } else if (expandBehavior === 'firstFailed') {
          tc.isExpand = !hasAnyExpanded && isExpandVerdict(tc.result.verdict);
        } else if (expandBehavior === 'same') {
          tc.isExpand = expandMemo[tcId];
        }
        await ProblemsManager.dataRefresh();
        hasAnyExpanded ||= tc.isExpand;
      }
    } finally {
      fullProblem.ac = null;
      await ProblemsManager.dataRefresh();
    }
  }
}

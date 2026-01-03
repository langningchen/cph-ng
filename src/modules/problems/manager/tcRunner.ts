import type * as msgs from '@w/msgs';
import { container } from 'tsyringe';
import { RunAllTcs } from '@/application/useCases/RunAllTcs';
import { RunSingleTc } from '@/application/useCases/RunSingleTc';
import { TOKENS } from '@/composition/tokens';
import {
  isRunningVerdict,
  TcVerdicts,
} from '@/types';
import { waitUntil } from '@/utils/global';

export class TcRunner {
  private static getRepository() {
    return container.resolve(TOKENS.ProblemRepository);
  }

  public static async runTc(msg: msgs.RunTcMsg): Promise<void> {
    const runSingleTc = container.resolve(RunSingleTc);
    await runSingleTc.exec(msg);
  }

  public static async runTcs(msg: msgs.RunTcsMsg): Promise<void> {
    const runAllTestCases = container.resolve(RunAllTcs);
    await runAllTestCases.exec(msg);
  }

  public static async stopTcs(msg: msgs.StopTcsMsg): Promise<void> {
    const fullProblem = await TcRunner.getRepository().getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    if (fullProblem.ac) {
      fullProblem.ac.abort(msg.onlyOne ? 'onlyOne' : undefined);
      if (msg.onlyOne) {
        return;
      }
      await waitUntil(() => !fullProblem.ac);
    }
    for (const tc of Object.values(fullProblem.problem.tcs)) {
      if (tc.result && isRunningVerdict(tc.result.verdict)) {
        tc.result.verdict = TcVerdicts.RJ;
      }
    }
    await TcRunner.getRepository().dataRefresh();
  }
}

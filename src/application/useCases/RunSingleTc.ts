// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import type * as msgs from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { ICompiler } from '@/application/ports/problems/ICompiler';
import type { ISolutionRunner } from '@/application/ports/problems/ISolutionRunner';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import { JudgeCoordinator } from '@/infrastructure/problems/judgeCoordinator';
import ProblemsManager from '@/modules/problems/manager';
import type { TcWithResult } from '@/types';
import { isExpandVerdict } from '@/types';
import { TcResult, TcVerdicts } from '@/types/types.backend';

@injectable()
export class RunSingleTc {
  constructor(
    @inject(TOKENS.Compiler) private readonly compiler: ICompiler,
    @inject(TOKENS.SolutionRunner)
    private readonly solutionRunner: ISolutionRunner,
    @inject(JudgeCoordinator) private readonly judge: JudgeCoordinator,
  ) {}

  async exec(msg: msgs.RunTcMsg): Promise<void> {
    if (!msg.activePath) {
      throw new Error('Active path is required');
    }

    const problem = (await ProblemsManager.getFullProblem(msg.activePath))
      ?.problem;
    if (!problem) {
      throw new Error('Problem not found');
    }
    const tc = problem.tcs[msg.id] as TcWithResult | undefined;
    if (!tc) {
      throw new Error('Test case not found');
    }

    // Prepare result state
    tc.result?.dispose();
    tc.result = new TcResult(TcVerdicts.CP);
    tc.isExpand = false;
    await ProblemsManager.dataRefresh();

    const ac = new AbortController();

    const compileOutcome = await this.compiler.compile(
      problem,
      msg.compile,
      ac,
    );
    if (!compileOutcome.ok) {
      if ('known' in compileOutcome) {
        tc.result.fromResult(compileOutcome.known);
        tc.isExpand = true;
        await ProblemsManager.dataRefresh();
        return;
      }
      throw compileOutcome.error;
    }

    tc.result.verdict = TcVerdicts.CPD;
    await ProblemsManager.dataRefresh();

    const runRes = await this.solutionRunner.run(
      {
        cmd: [compileOutcome.data.src.outputPath],
        stdin: tc.stdin,
        timeLimitMs: problem.timeLimit,
        memoryLimitMb: problem.memoryLimit,
      },
      ac,
    );
    const runOutcome = await this.judge.judge(
      {
        executionResult: runRes,
        inputPath: tc.stdin.toPath(),
        answerPath: tc.answer.toPath(),
        checkerPath: compileOutcome.data.checker?.outputPath,
        timeLimitMs: problem.timeLimit,
        memoryLimitMb: problem.memoryLimit,
      },
      ac,
    );

    tc.result.verdict = VERDICTS[runOutcome.verdict];
    tc.result.time = runOutcome.timeMs;
    tc.result.memory = runOutcome.memoryMb;
    tc.result.msg = runOutcome.messages;

    tc.isExpand = isExpandVerdict(tc.result.verdict);
    await ProblemsManager.dataRefresh();
  }
}

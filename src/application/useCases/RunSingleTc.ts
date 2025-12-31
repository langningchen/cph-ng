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
import type { ICompilerService } from '@/application/ports/problems/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/IJudgeServiceFactory';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import type { FinalResult } from '@/infrastructure/problems/resultEvaluator';
import ProblemsManager from '@/modules/problems/manager';
import { isExpandVerdict, type TcVerdict } from '@/types';
import { TcResult, TcVerdicts } from '@/types/types.backend';

@injectable()
export class RunSingleTc {
  constructor(
    @inject(TOKENS.JudgeServiceFactory)
    private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.CompilerService) private readonly compiler: ICompilerService,
  ) {}

  async exec(msg: msgs.RunTcMsg): Promise<void> {
    if (!msg.activePath) throw new Error('Active path is required');

    const fullProblem = await ProblemsManager.getFullProblem(msg.activePath);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    const tc = problem.tcs[msg.id];
    if (!tc) throw new Error('Test case not found');

    const ac = new AbortController();

    tc.result?.dispose();
    tc.result = new TcResult(TcVerdicts.CP);
    tc.isExpand = false;
    await ProblemsManager.dataRefresh();

    const artifacts = await this.compiler.compileAll(problem, msg.compile, ac);
    if (artifacts instanceof Error) {
      tc.result.verdict = TcVerdicts.CE;
      tc.result.msg = [artifacts.message];
      await ProblemsManager.dataRefresh();
      return;
    }
    tc.result.verdict = TcVerdicts.CPD;

    const ctx: JudgeContext = {
      problem,
      tcId: msg.id,
      stdinPath: tc.stdin.toPath(),
      answerPath: tc.answer.toPath(),
      compile: msg.compile,
      artifacts,
    };

    const observer: IJudgeObserver = {
      onStatusChange: (verdict: TcVerdict, message?: string) => {
        if (!tc.result) return;
        tc.result.verdict = verdict;
        if (message) tc.result.msg = [message];
        ProblemsManager.dataRefresh();
      },
      onResult: (res: FinalResult) => {
        if (!tc.result) return;
        tc.result.verdict = VERDICTS[res.verdict];
        tc.result.time = res.timeMs;
        tc.result.memory = res.memoryMb;
        tc.result.msg = res.messages;
        tc.isExpand = isExpandVerdict(tc.result.verdict);
        ProblemsManager.dataRefresh();
      },
      onError: (error: Error) => {
        if (!tc.result) return;
        tc.result.verdict = TcVerdicts.SE;
        tc.result.msg = [error.message];
        ProblemsManager.dataRefresh();
      },
    };

    try {
      const judgeService = this.judgeFactory.create(problem);
      await judgeService.judge(ctx, observer, ac);
    } catch (err) {
      observer.onError(err as Error);
    }
  }
}

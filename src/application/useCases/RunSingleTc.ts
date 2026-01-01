// Copyright (C) 2026 Langning Chen
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
import { CompileError, CompileRejected } from '@/application/ports/problems/ILanguageStrategy';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import type { FinalResult } from '@/infrastructure/problems/resultEvaluator';
import ProblemsManager from '@/modules/problems/manager';
import { TcResult, TcVerdicts } from '@/types/types.backend';

@injectable()
export class RunSingleTc {
  constructor(
    @inject(TOKENS.CompilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.JudgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
  ) {}

  async exec(msg: msgs.RunTcMsg): Promise<void> {
    const fullProblem = await ProblemsManager.getFullProblem(msg.activePath);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    const tc = problem.tcs[msg.id];
    if (!tc) throw new Error('Test case not found');

    const ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    tc.result?.dispose();
    tc.result = new TcResult(TcVerdicts.CP);
    tc.isExpand = false;
    await ProblemsManager.dataRefresh();

    const artifacts = await this.compiler.compileAll(problem, msg.compile, ac);
    if (artifacts instanceof Error) {
      tc.result.verdict =
        artifacts instanceof CompileError
          ? TcVerdicts.CE
          : artifacts instanceof CompileRejected
            ? TcVerdicts.RJ
            : TcVerdicts.SE;
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
      artifacts,
    };

    const observer: IJudgeObserver = {
      onStatusChange: (verdict, msg) => {
        if (!tc.result) return;
        tc.result.verdict = verdict;
        if (msg) tc.result.msg = [msg];
        ProblemsManager.dataRefresh();
      },
      onResult: (res: FinalResult) => {
        if (!tc.result) return;
        tc.result.verdict = VERDICTS[res.verdict];
        tc.result.time = res.timeMs;
        tc.result.memory = res.memoryMb;
        tc.result.msg = res.messages;
        tc.isExpand = true;
        ProblemsManager.dataRefresh();
      },
      onError: (e) => {
        if (!tc.result) return;
        tc.result.verdict = TcVerdicts.SE;
        tc.result.msg = [e.message];
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

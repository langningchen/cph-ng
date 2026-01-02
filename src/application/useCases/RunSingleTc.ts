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
import type { IProblemsManager } from '@/application/ports/problems/IProblemsManager';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import {
  CompileError,
  CompileRejected,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import { TcResult, TcVerdicts } from '@/types/types.backend';

@injectable()
export class RunSingleTc {
  constructor(
    @inject(TOKENS.CompilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.Document) private readonly document: IDocument,
    @inject(TOKENS.JudgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.ProblemsManager) private readonly problemsManager: IProblemsManager,
  ) {}

  async exec(msg: msgs.RunTcMsg): Promise<void> {
    const fullProblem = await this.problemsManager.getFullProblem(msg.activePath);
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
    await this.problemsManager.dataRefresh();

    await this.document.save(problem.src.path);
    const artifacts = await this.compiler.compileAll(problem, msg.compile, ac);
    if (artifacts instanceof Error) {
      tc.result.verdict =
        artifacts instanceof CompileError
          ? TcVerdicts.CE
          : artifacts instanceof CompileRejected
            ? TcVerdicts.RJ
            : TcVerdicts.SE;
      tc.result.msg = [artifacts.message];
      await this.problemsManager.dataRefresh();
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
        this.problemsManager.dataRefresh();
      },
      onResult: (res: FinalResult) => {
        if (!tc.result) return;
        tc.result.verdict = VERDICTS[res.verdict];
        tc.result.time = res.timeMs;
        tc.result.memory = res.memoryMb;
        tc.result.msg = res.messages;
        tc.isExpand = true;
        this.problemsManager.dataRefresh();
      },
      onError: (e) => {
        if (!tc.result) return;
        tc.result.verdict = TcVerdicts.SE;
        tc.result.msg = [e.message];
        this.problemsManager.dataRefresh();
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

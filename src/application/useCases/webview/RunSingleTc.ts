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

import { inject, injectable } from 'tsyringe';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import type { ITcService } from '@/application/ports/problems/ITcService';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import {
  CompileError,
  CompileRejected,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import { VerdictName } from '@/domain/entities/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { RunTcMsg } from '@/webview/src/msgs';

@injectable()
export class RunSingleTc extends BaseProblemUseCase<RunTcMsg> {
  constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.document) private readonly document: IDocument,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.tcService) private readonly tcService: ITcService,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    super(repo, true);
  }

  protected async performAction(fullProblem: FullProblem, msg: RunTcMsg): Promise<void> {
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    const tc = problem.getTc(msg.id);
    if (!tc) throw new Error('Test case not found');

    const ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    this.tmp.dispose(tc.clearResult());
    tc.updateResult(VerdictName.compiling, { isExpand: false });
    await this.repo.dataRefresh();

    await this.document.save(problem.src.path);
    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      tc.updateResult(
        artifacts instanceof CompileError
          ? VerdictName.compilationError
          : artifacts instanceof CompileRejected
            ? VerdictName.rejected
            : VerdictName.systemError,
        { msg: artifacts.message },
      );
      await this.repo.dataRefresh();
      return;
    }
    tc.updateResult(VerdictName.compiled);

    const judgeService = this.judgeFactory.create(problem);

    const ctx: JudgeContext = {
      problem,
      ...(await this.tcService.getPaths(tc)),
      artifacts,
    };

    const observer: IJudgeObserver = {
      onStatusChange: (verdict, msg) => {
        tc.updateResult(verdict, { msg });
        this.repo.dataRefresh();
      },
      onResult: (res: FinalResult) => {
        tc.updateResult(res.verdict, {
          isExpand: true,
          timeMs: res.timeMs,
          memoryMb: res.memoryMb,
          msg: res.msg,
        });
        this.repo.dataRefresh();
      },
      onError: (e) => {
        tc.updateResult(VerdictName.systemError, { msg: e.message });
        this.repo.dataRefresh();
      },
    };

    await judgeService.judge(ctx, observer, ac.signal);
    fullProblem.ac = null;
  }
}

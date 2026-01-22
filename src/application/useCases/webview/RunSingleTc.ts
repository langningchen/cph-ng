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
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
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
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { VerdictName } from '@/domain/entities/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { RunTcMsg } from '@/webview/src/msgs';

@injectable()
export class RunSingleTc extends BaseProblemUseCase<RunTcMsg> {
  public constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.document) private readonly document: IDocument,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.tcService) private readonly tcService: ITcService,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    super(repo);
  }

  protected async performAction(bgProblem: BackgroundProblem, msg: RunTcMsg): Promise<void> {
    if (!bgProblem) throw new Error('Problem not found');
    const { problem } = bgProblem;

    const tc = problem.getTc(msg.id);
    if (!tc) throw new Error('Test case not found');

    const ac = new AbortController();
    bgProblem.ac = ac;

    this.tmp.dispose(tc.clearResult());
    tc.updateResult({ verdict: VerdictName.compiling, isExpand: false });

    await this.document.save(problem.src.path);
    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      tc.updateResult({
        verdict:
          artifacts instanceof CompileError
            ? VerdictName.compilationError
            : artifacts instanceof CompileRejected
              ? VerdictName.rejected
              : VerdictName.systemError,
        msg: artifacts.message,
      });
      return;
    }
    tc.updateResult({ verdict: VerdictName.compiled });

    const judgeService = this.judgeFactory.create(problem);
    const ctx: JudgeContext = { problem, ...(await this.tcService.getPaths(tc)), artifacts };

    const observer: IJudgeObserver = {
      onStatusChange: (verdict) => {
        tc.updateResult({ verdict });
      },
      onResult: (res: FinalResult) => {
        tc.updateResult({ isExpand: true, ...res });
      },
      onError: (e) => {
        tc.updateResult({ verdict: VerdictName.systemError, msg: e.message });
      },
    };

    await judgeService.judge(ctx, observer, ac.signal);
    bgProblem.abort();
  }
}

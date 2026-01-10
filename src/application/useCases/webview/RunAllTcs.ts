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
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import { isExpandVerdict, VerdictName } from '@/domain/entities/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { RunTcsMsg } from '@/webview/src/msgs';

@injectable()
export class RunAllTcs extends BaseProblemUseCase<RunTcsMsg> {
  constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.document) private readonly document: IDocument,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.tcService) private readonly tcService: ITcService,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    super(repo, true);
  }

  protected async performAction(fullProblem: FullProblem, msg: RunTcsMsg): Promise<void> {
    const { problem } = fullProblem;
    let ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    const tcOrder = problem.getEnabledTcIds();

    const expandMemo: Record<string, boolean> = {};
    for (const tcId of tcOrder) {
      const tc = problem.getTc(tcId);
      this.tmp.dispose(tc.clearResult());
      tc.updateResult(VerdictName.compiling, { isExpand: false });
      expandMemo[tcId] = tc.isExpand;
    }
    await this.repo.dataRefresh();

    await this.document.save(problem.src.path);
    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      problem.updateResult(
        artifacts instanceof CompileError
          ? VerdictName.compilationError
          : artifacts instanceof CompileRejected
            ? VerdictName.rejected
            : VerdictName.systemError,
        { msg: artifacts.message },
      );
      return;
    }

    problem.updateResult(VerdictName.compiled);
    await this.repo.dataRefresh();

    const expandBehavior = this.settings.problem.expandBehavior;
    let hasAnyExpanded = false;

    const judgeService = this.judgeFactory.create(problem);

    for (const tcId of tcOrder) {
      const tc = problem.getTc(tcId);

      if (ac.signal.aborted) {
        if (ac.signal.reason === 'onlyOne') fullProblem.ac = ac = new AbortController();
        else {
          tc.updateResult(VerdictName.skipped);
          continue;
        }
      }

      const ctx: JudgeContext = {
        problem,
        tcId,
        ...(await this.tcService.getPaths(tc)),
        artifacts,
      };

      const observer: IJudgeObserver = {
        onStatusChange: (verdict, msg) => {
          tc.updateResult(verdict, { msg });
          this.repo.dataRefresh();
        },
        onResult: (res: FinalResult) => {
          let isExpand: boolean = false;
          if (expandBehavior === 'always') {
            isExpand = true;
          } else if (expandBehavior === 'never') {
            isExpand = false;
          } else if (expandBehavior === 'failed') {
            isExpand = isExpandVerdict(res.verdict);
          } else if (expandBehavior === 'first') {
            isExpand = !hasAnyExpanded;
          } else if (expandBehavior === 'firstFailed') {
            isExpand = !hasAnyExpanded && isExpandVerdict(res.verdict);
          } else if (expandBehavior === 'same') {
            isExpand = expandMemo[tcId];
          }
          hasAnyExpanded ||= isExpand;

          tc.updateResult(res.verdict, {
            isExpand,
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
    }
    fullProblem.ac = null;
  }
}

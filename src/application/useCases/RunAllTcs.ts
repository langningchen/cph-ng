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
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { VERDICTS } from '@/domain/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluator';
import { isExpandVerdict, TcVerdicts } from '@/types';
import { TcResult } from '@/types/types.backend';

@injectable()
export class RunAllTcs {
  constructor(
    @inject(TOKENS.CompilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.JudgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.ProblemsManager) private readonly problemsManager: IProblemsManager,
  ) {}

  async exec(msg: msgs.RunTcsMsg): Promise<void> {
    if (!msg.activePath) throw new Error('Active path is required');

    const fullProblem = await this.problemsManager.getFullProblem(msg.activePath);
    if (!fullProblem) throw new Error('Problem not found');
    const { problem } = fullProblem;

    let ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    try {
      const tcs = problem.tcs;
      const tcOrder = [...problem.tcOrder].filter((id) => !tcs[id].isDisabled);

      const expandMemo: Record<string, boolean> = {};
      for (const tcId of tcOrder) {
        tcs[tcId].result?.dispose();
        tcs[tcId].result = new TcResult(TcVerdicts.CP);
        expandMemo[tcId] = tcs[tcId].isExpand;
        tcs[tcId].isExpand = false;
      }
      await this.problemsManager.dataRefresh();

      const artifacts = await this.compiler.compileAll(problem, msg.compile, ac);
      if (artifacts instanceof Error) {
        for (const tcId of tcOrder) {
          const tc = tcs[tcId];
          if (tc.result) {
            tc.result.verdict =
              artifacts instanceof CompileError
                ? TcVerdicts.CE
                : artifacts instanceof CompileRejected
                  ? TcVerdicts.RJ
                  : TcVerdicts.SE;
            tc.result.msg = [artifacts.message];
          }
        }
        await this.problemsManager.dataRefresh();
        return;
      }

      for (const tcId of tcOrder) if (tcs[tcId].result) tcs[tcId].result.verdict = TcVerdicts.CPD;
      await this.problemsManager.dataRefresh();

      const expandBehavior = this.settings.problem.expandBehavior;
      let hasAnyExpanded = false;

      const judgeService = this.judgeFactory.create(problem);

      for (const tcId of tcOrder) {
        const tc = tcs[tcId];
        if (!tc.result) continue;

        if (ac.signal.aborted) {
          if (ac.signal.reason === 'onlyOne') fullProblem.ac = ac = new AbortController();
          else {
            tc.result.verdict = TcVerdicts.SK;
            continue;
          }
        }

        const ctx: JudgeContext = {
          problem,
          tcId,
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

            const currentVerdict = tc.result.verdict;
            if (expandBehavior === 'always') {
              tc.isExpand = true;
            } else if (expandBehavior === 'never') {
              tc.isExpand = false;
            } else if (expandBehavior === 'failed') {
              tc.isExpand = isExpandVerdict(currentVerdict);
            } else if (expandBehavior === 'first') {
              tc.isExpand = !hasAnyExpanded;
            } else if (expandBehavior === 'firstFailed') {
              tc.isExpand = !hasAnyExpanded && isExpandVerdict(currentVerdict);
            } else if (expandBehavior === 'same') {
              tc.isExpand = expandMemo[tcId];
            }

            hasAnyExpanded ||= tc.isExpand;
            this.problemsManager.dataRefresh();
          },
          onError: (e) => {
            if (!tc.result) return;
            tc.result.verdict = TcVerdicts.SE;
            tc.result.msg = [e.message];
            this.problemsManager.dataRefresh();
          },
        };

        await judgeService.judge(ctx, observer, ac);
      }
    } finally {
      fullProblem.ac = null;
      await this.problemsManager.dataRefresh();
    }
  }
}

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
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import {
  CompileAborted,
  CompileError,
} from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { VerdictName, Verdicts, VerdictType } from '@/domain/entities/verdict';
import type { TestcaseId } from '@/domain/types';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { RunTestcasesMsg } from '@/webview/src/msgs';

@injectable()
export class RunAllTestcases extends BaseProblemUseCase<RunTestcasesMsg> {
  public constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.document) private readonly document: IDocument,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
  ) {
    super(repo);
  }

  protected async performAction(bgProblem: BackgroundProblem, msg: RunTestcasesMsg): Promise<void> {
    const { problem } = bgProblem;
    let ac = new AbortController();
    let currentId: TestcaseId | null = null;
    let skipAll: boolean = false;
    bgProblem.ac = new AbortController();
    bgProblem.ac.signal.addEventListener('abort', () => {
      const testcaseId = bgProblem.ac?.signal.reason as TestcaseId | null;
      if (typeof testcaseId !== 'string') {
        ac.abort();
        skipAll = true;
      } else if (testcaseId === currentId) {
        ac.abort();
        ac = new AbortController();
        bgProblem.ac = new AbortController();
      } else {
        problem.getTestcase(testcaseId).updateResult({ verdict: VerdictName.skipped });
        bgProblem.ac = new AbortController();
      }
    });

    const testcaseOrder = problem.getEnabledTestcaseIds();

    for (const testcaseId of testcaseOrder) {
      const testcase = problem.getTestcase(testcaseId);
      this.tmp.dispose(testcase.clearResult());
      testcase.updateResult({ verdict: VerdictName.compiling });
    }

    await this.document.save(problem.src.path);
    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      const verdict =
        artifacts instanceof CompileError
          ? VerdictName.compilationError
          : artifacts instanceof CompileAborted
            ? VerdictName.rejected
            : VerdictName.systemError;
      problem.updateResult({ verdict, msg: artifacts.message });
      return;
    }
    problem.updateResult({ verdict: VerdictName.compiled });

    const expandBehavior = this.settings.problem.expandBehavior;
    let hasAnyExpanded = false;

    const judgeService = this.judgeFactory.create(problem);

    for (const testcaseId of testcaseOrder) {
      currentId = testcaseId;
      const testcase = problem.getTestcase(testcaseId);
      if (testcase.verdict !== VerdictName.compiled) continue;
      if (skipAll) {
        testcase.updateResult({ verdict: VerdictName.skipped });
        continue;
      }

      const stdinPathResult = await this.testcaseIoService.ensureFilePath(testcase.stdin);
      const answerPathResult = await this.testcaseIoService.ensureFilePath(testcase.answer);
      const ctx: JudgeContext = {
        problem,
        stdinPath: stdinPathResult.path,
        answerPath: answerPathResult.path,
        artifacts,
      };

      const observer: IJudgeObserver = {
        onStatusChange: (verdict) => {
          testcase.updateResult({ verdict });
        },
        onResult: (res: FinalResult) => {
          let isExpand: boolean = false;
          if (expandBehavior === 'always') {
            isExpand = true;
          } else if (expandBehavior === 'never') {
            isExpand = false;
          } else if (expandBehavior === 'failed') {
            isExpand = Verdicts[res.verdict].type === VerdictType.failed;
          } else if (expandBehavior === 'first') {
            isExpand = !hasAnyExpanded;
          } else if (expandBehavior === 'firstFailed') {
            isExpand = !hasAnyExpanded && Verdicts[res.verdict].type === VerdictType.failed;
          } else if (expandBehavior === 'same') {
            isExpand = testcase.isExpand;
          }
          hasAnyExpanded ||= isExpand;

          testcase.updateResult({ isExpand, ...res });
        },
        onError: (e) => {
          testcase.updateResult({ verdict: VerdictName.systemError, msg: e.message });
        },
      };

      await judgeService.judge(ctx, observer, ac.signal);

      if (stdinPathResult.needDispose) this.tmp.dispose(stdinPathResult.path);
      if (answerPathResult.needDispose) this.tmp.dispose(answerPathResult.path);
    }
    bgProblem.abort();
  }
}

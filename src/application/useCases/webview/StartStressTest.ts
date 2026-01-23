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
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { StressTestState } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';
import { VerdictName } from '@/domain/entities/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { StartStressTestMsg } from '@/webview/src/msgs';

@injectable()
export class StartStressTest extends BaseProblemUseCase<StartStressTestMsg> {
  public constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo);
  }

  protected async performAction(
    fullProblem: BackgroundProblem,
    msg: StartStressTestMsg,
  ): Promise<void> {
    const { problem } = fullProblem;
    const stressTest = problem.stressTest;
    if (!stressTest || !stressTest.generator || !stressTest.bruteForce) {
      this.ui.alert(
        'warn',
        this.translator.t('Please choose both generator and brute force files first.'),
      );
      return;
    }

    const ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    stressTest.state = StressTestState.compiling;

    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      stressTest.state = StressTestState.compilationError;
      return;
    }
    if (!artifacts.stressTest) {
      stressTest.state = StressTestState.internalError;
      return;
    }

    const judgeService = this.judgeFactory.create(problem);
    stressTest.clearCnt();

    while (!ac.signal.aborted) {
      stressTest.count();
      stressTest.state = StressTestState.generating;
      const genRes = await this.executor.execute({
        cmd: [artifacts.stressTest.generator.path],
        timeoutMs: this.settings.stressTest.generatorTimeLimit,
        signal: ac.signal,
      });
      if (genRes instanceof Error) {
        stressTest.state = StressTestState.internalError;
        this.ui.alert('warn', genRes.message);
        break;
      }

      stressTest.state = StressTestState.runningBruteForce;
      const bfRes = await this.executor.execute({
        cmd: [artifacts.stressTest.bruteForce.path],
        timeoutMs: this.settings.stressTest.bruteForceTimeLimit,
        signal: ac.signal,
        stdinPath: genRes.stdoutPath,
      });
      if (bfRes instanceof Error) {
        stressTest.state = StressTestState.internalError;
        this.ui.alert('warn', bfRes.message);
        break;
      }

      const ctx: JudgeContext = {
        problem,
        stdinPath: genRes.stdoutPath,
        answerPath: bfRes.stdoutPath,
        artifacts,
      };

      const observer: IJudgeObserver = {
        onStatusChange: () => {},
        onResult: async (res: FinalResult) => {
          if (res.verdict === VerdictName.accepted) return;
          if (res.verdict === VerdictName.rejected) stressTest.state = StressTestState.inactive;
          else {
            stressTest.state = StressTestState.foundDifference;
            const newTestcase = new Testcase(
              await this.testcaseIoService.tryInlining(new TestcaseIo({ path: genRes.stdoutPath })),
              await this.testcaseIoService.tryInlining(new TestcaseIo({ path: bfRes.stdoutPath })),
              true,
            );
            newTestcase.updateResult({
              verdict: res.verdict,
              timeMs: res.timeMs,
              memoryMb: res.memoryMb,
              msg: res.msg,
            });
            problem.addTestcase(this.crypto.randomUUID(), newTestcase);
          }
        },
        onError: (e) => {
          stressTest.state = StressTestState.internalError;
          this.ui.alert('warn', e.message);
        },
      };

      stressTest.state = StressTestState.runningSolution;
      await judgeService.judge(ctx, observer, ac.signal);
      if (!stressTest.isRunning) break;

      this.tmp.dispose([genRes.stdoutPath, genRes.stderrPath, bfRes.stdoutPath, bfRes.stderrPath]);
    }
    fullProblem.abort();
  }
}

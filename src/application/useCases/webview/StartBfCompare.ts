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
import type { ITcIoService } from '@/application/ports/problems/ITcIoService';
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
import { BfCompareState } from '@/domain/entities/bfCompare';
import { Tc } from '@/domain/entities/tc';
import { TcIo } from '@/domain/entities/tcIo';
import { VerdictName } from '@/domain/entities/verdict';
import type { FinalResult } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import type { StartBfCompareMsg } from '@/webview/src/msgs';

@injectable()
export class StartBfCompare extends BaseProblemUseCase<StartBfCompareMsg> {
  public constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.tcIoService) private readonly tcIoService: ITcIoService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    super(repo);
  }

  protected async performAction(
    fullProblem: BackgroundProblem,
    msg: StartBfCompareMsg,
  ): Promise<void> {
    const { problem } = fullProblem;
    const bf = problem.bfCompare;
    if (!bf || !bf.generator || !bf.bruteForce) {
      this.ui.alert(
        'warn',
        this.translator.t('Please choose both generator and brute force files first.'),
      );
      return;
    }

    const ac = new AbortController();
    fullProblem.ac?.abort();
    fullProblem.ac = ac;

    bf.state = BfCompareState.compiling;

    const artifacts = await this.compiler.compileAll(problem, msg.forceCompile, ac.signal);
    if (artifacts instanceof Error) {
      bf.state = BfCompareState.compilationError;
      return;
    }
    if (!artifacts.bfCompare) {
      bf.state = BfCompareState.internalError;
      return;
    }

    const judgeService = this.judgeFactory.create(problem);
    bf.clearCnt();

    while (!ac.signal.aborted) {
      bf.count();
      bf.state = BfCompareState.generating;
      const genRes = await this.executor.execute({
        cmd: [artifacts.bfCompare.generator.path],
        timeoutMs: this.settings.bfCompare.generatorTimeLimit,
        signal: ac.signal,
      });
      if (genRes instanceof Error) {
        bf.state = BfCompareState.internalError;
        this.ui.alert('warn', genRes.message);
        break;
      }

      bf.state = BfCompareState.runningBruteForce;
      const bfRes = await this.executor.execute({
        cmd: [artifacts.bfCompare.bruteForce.path],
        timeoutMs: this.settings.bfCompare.bruteForceTimeLimit,
        signal: ac.signal,
        stdinPath: genRes.stdoutPath,
      });
      if (bfRes instanceof Error) {
        bf.state = BfCompareState.internalError;
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
          if (res.verdict === VerdictName.rejected) bf.state = BfCompareState.inactive;
          else {
            bf.state = BfCompareState.foundDifference;
            const newTc = new Tc(
              await this.tcIoService.tryInlining(new TcIo({ path: genRes.stdoutPath })),
              await this.tcIoService.tryInlining(new TcIo({ path: bfRes.stdoutPath })),
              true,
            );
            newTc.updateResult(res.verdict, {
              timeMs: res.timeMs,
              memoryMb: res.memoryMb,
              msg: res.msg,
            });
            problem.addTc(this.crypto.randomUUID(), newTc);
          }
        },
        onError: (e) => {
          bf.state = BfCompareState.internalError;
          this.ui.alert('warn', e.message);
        },
      };

      bf.state = BfCompareState.runningSolution;
      await judgeService.judge(ctx, observer, ac.signal);
      if (!bf.isRunning) break;

      this.tmp.dispose([genRes.stdoutPath, genRes.stderrPath, bfRes.stdoutPath, bfRes.stderrPath]);
    }
    fullProblem.abort();
  }
}

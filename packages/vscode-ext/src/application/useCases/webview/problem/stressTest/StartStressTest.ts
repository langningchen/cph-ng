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

import type { StartStressTestMsg, TestcaseId } from '@cph-ng/core';
import { StressTestState, VerdictName } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import {
  AbortReason,
  type IProcessExecutor,
  type ProcessOptions,
} from '@/application/ports/node/IProcessExecutor';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeObserver } from '@/application/ports/problems/judge/IJudgeObserver';
import type { JudgeContext } from '@/application/ports/problems/judge/IJudgeService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import type { FinalResult } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/problem/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { StressTest } from '@/domain/entities/stressTest';
import { Testcase } from '@/domain/entities/testcase';
import { TestcaseIo } from '@/domain/entities/testcaseIo';

@injectable()
export class StartStressTest extends BaseProblemUseCase<StartStressTestMsg> {
  private tempFiles: string[] = [];

  public constructor(
    @inject(TOKENS.compilerService) private readonly compiler: ICompilerService,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.judgeServiceFactory) private readonly judgeFactory: IJudgeServiceFactory,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.processExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.tempStorage) private readonly tmp: ITempStorage,
    @inject(TOKENS.testcaseIoService) private readonly testcaseIoService: ITestcaseIoService,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    super(repo);
  }

  protected async performAction(
    fullProblem: BackgroundProblem,
    msg: StartStressTestMsg,
  ): Promise<void> {
    const { problem } = fullProblem;
    const stressTest = problem.stressTest;
    if (!stressTest?.generator || !stressTest?.bruteForce) {
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
      fullProblem.abort();
      return;
    }
    if (!artifacts.stressTest) {
      stressTest.state = StressTestState.internalError;
      fullProblem.abort();
      return;
    }

    const genCwd = this.path.dirname(stressTest.generator.path);
    const bfCwd = this.path.dirname(stressTest.bruteForce.path);
    const judgeService = this.judgeFactory.create(problem);
    stressTest.clearCnt();

    try {
      while (!ac.signal.aborted) {
        stressTest.count();
        stressTest.state = StressTestState.generating;
        const genRes = await this.runStep({
          cmd: [artifacts.stressTest.generator.path],
          cwd: genCwd,
          timeoutMs: this.settings.stressTest.generatorTimeLimit,
          signal: ac.signal,
        });
        if (!genRes) break;

        stressTest.state = StressTestState.runningBruteForce;
        const bfRes = await this.runStep({
          cmd: [artifacts.stressTest.bruteForce.path],
          cwd: bfCwd,
          timeoutMs: this.settings.stressTest.bruteForceTimeLimit,
          signal: ac.signal,
          stdinPath: genRes.stdoutPath,
        });
        if (!bfRes) break;

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
              const testcaseId = this.crypto.randomUUID() as TestcaseId;

              const testcase = new Testcase(
                await this.testcaseIoService.tryInlining(
                  new TestcaseIo({ path: genRes.stdoutPath }),
                ),
                await this.testcaseIoService.tryInlining(
                  new TestcaseIo({ path: bfRes.stdoutPath }),
                ),
                true,
              );

              if (testcase.stdin.path) {
                const inputFile = this.problemService.getTestcasePath(
                  problem.src.path,
                  testcaseId,
                  this.settings.problem.inputFileExtensionList[0].substring(1) || 'in',
                );
                if (inputFile) {
                  await this.fs.copyFile(genRes.stdoutPath, inputFile);
                  testcase.stdin = new TestcaseIo({ path: inputFile });
                }
              }
              if (testcase.answer.path) {
                const outputFile = this.problemService.getTestcasePath(
                  problem.src.path,
                  testcaseId,
                  this.settings.problem.outputFileExtensionList[0].substring(1) || 'out',
                );
                if (outputFile) {
                  await this.fs.copyFile(bfRes.stdoutPath, outputFile);
                  testcase.answer = new TestcaseIo({ path: outputFile });
                }
              }

              testcase.updateResult({
                verdict: res.verdict,
                timeMs: res.timeMs,
                memoryMb: res.memoryMb,
                msg: res.msg,
              });
              problem.addTestcase(testcaseId, testcase);
            }
          },
          onError: (e) => {
            throw e;
          },
        };

        stressTest.state = StressTestState.runningSolution;
        await judgeService.judge(ctx, observer, ac.signal);
        if (!stressTest.isRunning) break;
        this.cleanup();
      }
    } catch (e) {
      this.handleError(stressTest, e as Error);
    } finally {
      this.cleanup();
      if (ac.signal.aborted) stressTest.state = StressTestState.inactive;
      fullProblem.abort();
    }
  }

  private cleanup() {
    this.tmp.dispose(this.tempFiles);
    this.tempFiles = [];
  }
  private async runStep(params: ProcessOptions) {
    const res = await this.executor.execute(params);
    if (res instanceof Error) throw res;
    if (res.abortReason === AbortReason.UserAbort) return null;
    this.tempFiles.push(res.stdoutPath, res.stderrPath);
    return res;
  }
  private handleError(stressTest: StressTest, error: Error) {
    stressTest.state = StressTestState.internalError;
    this.ui.alert('warn', error.message);
  }
}

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
import type { IPath } from '@/application/ports/node/IPath';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';
import { isRunningState, type StressTest, StressTestState } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import type { TestcaseIo } from '@/domain/entities/testcaseIo';
import { type Verdict, VerdictName, Verdicts } from '@/domain/entities/verdict';
import type { IFileWithHash, IOverrides, TestcaseId } from '@/domain/types';
import type {
  IWebviewFileWithHash,
  IWebviewOverrides,
  IWebviewProblem,
  IWebviewStressTest,
  IWebviewTestcase,
  IWebviewTestcaseIo,
  IWebviewTestcaseResult,
} from '@/domain/webviewTypes';

@injectable()
export class WebviewProblemMapper {
  public constructor(
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {}

  public toDto(entity: Problem): IWebviewProblem {
    const testcases: Record<TestcaseId, IWebviewTestcase> = {};
    for (const testcaseId of entity.testcaseOrder) {
      const testcase = entity.testcases.get(testcaseId);
      if (testcase) testcases[testcaseId] = this.testcaseToDto(testcase);
    }
    return {
      name: entity.name,
      url: entity.url,
      testcases,
      testcaseOrder: [...entity.testcaseOrder],
      src: this.fileWithHashToDto(entity.src),
      checker: entity.checker ? this.fileWithHashToDto(entity.checker) : null,
      interactor: entity.interactor ? this.fileWithHashToDto(entity.interactor) : null,
      stressTest: this.stressTestToDto(entity.stressTest),
      timeElapsedMs: entity.timeElapsedMs,
      overrides: this.overrideToDto(entity.src.path, entity.overrides),
    };
  }

  public testcaseToDto(testcase: Testcase): IWebviewTestcase;
  public testcaseToDto(testcase: Partial<Testcase>): Partial<IWebviewTestcase>;
  public testcaseToDto(testcase: Partial<Testcase>): Partial<IWebviewTestcase> {
    return {
      stdin: testcase.stdin ? this.testcaseIoToDto(testcase.stdin) : undefined,
      answer: testcase.answer ? this.testcaseIoToDto(testcase.answer) : undefined,
      isExpand: testcase.isExpand,
      isDisabled: testcase.isDisabled,
      result: testcase.verdict
        ? {
            verdict: this.getVerdict(testcase.verdict),
            timeMs: testcase.timeMs,
            memoryMb: testcase.memoryMb,
            stdout: testcase.stdout ? this.testcaseIoToDto(testcase.stdout) : undefined,
            stderr: testcase.stderr ? this.testcaseIoToDto(testcase.stderr) : undefined,
            msg: testcase.msg,
          }
        : undefined,
    };
  }
  public testcaseResultToDto(
    testcaseResult: Partial<TestcaseResult>,
  ): Partial<IWebviewTestcaseResult> {
    return {
      verdict: testcaseResult.verdict ? this.getVerdict(testcaseResult.verdict) : undefined,
      timeMs: testcaseResult.timeMs,
      memoryMb: testcaseResult.memoryMb,
      stdout: testcaseResult.stdout ? this.testcaseIoToDto(testcaseResult.stdout) : undefined,
      stderr: testcaseResult.stderr ? this.testcaseIoToDto(testcaseResult.stderr) : undefined,
      msg: testcaseResult.msg,
    };
  }
  private testcaseIoToDto(testcaseIo: TestcaseIo): IWebviewTestcaseIo {
    return testcaseIo.match<IWebviewTestcaseIo>(
      (path) => ({ ...this.fileWithHashToDto({ path }), type: 'file' }),
      (data) => ({ type: 'string', data }),
    );
  }
  public stressTestToDto(stressTest: StressTest): IWebviewStressTest;
  public stressTestToDto(stressTest: Partial<StressTest>): Partial<IWebviewStressTest>;
  public stressTestToDto(stressTest: Partial<StressTest>): Partial<IWebviewStressTest> {
    const msgs = {
      [StressTestState.inactive]: this.translator.t('Brute Force Compare is Idle'),
      [StressTestState.compiling]: this.translator.t('Compiling...'),
      [StressTestState.compilationError]: this.translator.t('Compilation Error'),
      [StressTestState.generating]: this.translator.t('Generating Data (#{cnt})...', {
        cnt: stressTest.cnt,
      }),
      [StressTestState.runningBruteForce]: this.translator.t('Running Brute Force (#{cnt})...', {
        cnt: stressTest.cnt,
      }),
      [StressTestState.runningSolution]: this.translator.t('Running Solution (#{cnt})...'),
      [StressTestState.foundDifference]: this.translator.t('Difference found at case #{cnt}', {
        cnt: stressTest.cnt,
      }),
      [StressTestState.internalError]: this.translator.t('Internal Error'),
    };
    return {
      generator: stressTest.generator ? this.fileWithHashToDto(stressTest.generator) : undefined,
      bruteForce: stressTest.bruteForce ? this.fileWithHashToDto(stressTest.bruteForce) : undefined,
      isRunning: isRunningState(stressTest.state),
      msg: stressTest.state ? msgs[stressTest.state] : undefined,
    };
  }
  public fileWithHashToDto(fileWithHash: IFileWithHash): IWebviewFileWithHash {
    return {
      path: fileWithHash.path,
      base: this.path.basename(fileWithHash.path),
    };
  }
  private overrideToDto(
    srcPath: string,
    { timeLimitMs, memoryLimitMb, compiler, compilerArgs, runner, runnerArgs }: IOverrides,
  ): IWebviewOverrides {
    const { defaultTimeLimit, defaultMemoryLimit } = this.settings.problem;
    const lang = this.lang.getLang(srcPath);
    const defaultCompiler = lang?.defaultValues.compiler;
    const defaultCompilerArgs = lang?.defaultValues.compilerArgs;
    const defaultRunner = lang?.defaultValues.runner;
    const defaultRunnerArgs = lang?.defaultValues.runnerArgs;
    return {
      timeLimitMs: { defaultValue: defaultTimeLimit, override: timeLimitMs || null },
      memoryLimitMb: { defaultValue: defaultMemoryLimit, override: memoryLimitMb || null },
      compiler: defaultCompiler
        ? { defaultValue: defaultCompiler, override: compiler || null }
        : undefined,
      compilerArgs: defaultCompilerArgs
        ? { defaultValue: defaultCompilerArgs, override: compilerArgs || null }
        : undefined,
      runner: defaultRunner ? { defaultValue: defaultRunner, override: runner || null } : undefined,
      runnerArgs: defaultRunnerArgs
        ? { defaultValue: defaultRunnerArgs, override: runnerArgs || null }
        : undefined,
    };
  }

  private getVerdict(verdict: VerdictName): Verdict {
    const fullName: Record<VerdictName, string> = {
      [VerdictName.unknownError]: this.translator.t('Unknown Error'),
      [VerdictName.accepted]: this.translator.t('Accepted'),
      [VerdictName.partiallyCorrect]: this.translator.t('Partially Correct'),
      [VerdictName.presentationError]: this.translator.t('Presentation Error'),
      [VerdictName.wrongAnswer]: this.translator.t('Wrong Answer'),
      [VerdictName.timeLimitExceed]: this.translator.t('Time Limit Exceed'),
      [VerdictName.memoryLimitExceed]: this.translator.t('Memory Limit Exceed'),
      [VerdictName.outputLimitExceed]: this.translator.t('Output Limit Exceed'),
      [VerdictName.runtimeError]: this.translator.t('Runtime Error'),
      [VerdictName.restrictedFunction]: this.translator.t('Restricted Function'),
      [VerdictName.compilationError]: this.translator.t('Compilation Error'),
      [VerdictName.systemError]: this.translator.t('System Error'),
      [VerdictName.waiting]: this.translator.t('Waiting'),
      [VerdictName.fetched]: this.translator.t('Fetched'),
      [VerdictName.compiling]: this.translator.t('Compiling'),
      [VerdictName.compiled]: this.translator.t('Compiled'),
      [VerdictName.judging]: this.translator.t('Judging'),
      [VerdictName.judged]: this.translator.t('Judged'),
      [VerdictName.comparing]: this.translator.t('Comparing'),
      [VerdictName.skipped]: this.translator.t('Skipped'),
      [VerdictName.rejected]: this.translator.t('Rejected'),
    };
    return { ...Verdicts[verdict], fullName: fullName[verdict] };
  }
}

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

// biome-ignore-all lint/suspicious/noExplicitAny: Legacy data migration requires any type.

import { compare, lte } from 'semver';
import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type * as History from '@/application/ports/problems/history';
import type { IProblemMigrationService } from '@/application/ports/problems/IProblemMigrationService';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { StressTestState } from '@/domain/entities/stressTest';
import type { VerdictName } from '@/domain/entities/verdict';

@injectable()
export class ProblemMigrationService implements IProblemMigrationService {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
  ) {
    this.logger = this.logger.withScope('migration');
  }

  private readonly migrateFunctions: Record<string, (oldProblem: any) => any> = {
    '0.6.0': (_: History.IProblem_0_6_0): null => null,
    '0.4.8': (problem: History.IProblem_0_4_8): History.IProblem_0_6_0 => {
      const testcases: History.IProblem_0_6_0['testcases'] = {};
      for (const testcaseId of problem.tcOrder) {
        const testcase = problem.tcs[testcaseId];
        const migrateTestcaseIo = (
          testcaseIo: History.ITestcaseIo_0_4_8,
        ): History.ITestcaseIo_0_6_0 => {
          if (testcaseIo.useFile) return { path: testcaseIo.data };
          return { data: testcaseIo.data };
        };
        if (testcase)
          testcases[testcaseId] = {
            stdin: migrateTestcaseIo(testcase.stdin),
            answer: migrateTestcaseIo(testcase.answer),
            isExpand: testcase.isExpand,
            isDisabled: testcase.isDisabled,
            result: testcase.result
              ? {
                  verdict: testcase.result.verdict.name as VerdictName,
                  timeMs: testcase.result.time,
                  memoryMb: testcase.result.memory,
                  stdout: migrateTestcaseIo(testcase.result.stdout),
                  stderr: migrateTestcaseIo(testcase.result.stderr),
                  msg: testcase.result.msg.join('\n'),
                }
              : undefined,
          };
      }

      return {
        version: '0.6.0',
        name: problem.name,
        url: problem.url,
        testcases,
        testcaseOrder: problem.tcOrder,
        src: problem.src,
        checker: problem.checker || null,
        interactor: problem.interactor || null,
        stressTest: {
          generator: problem.bfCompare?.generator || null,
          bruteForce: problem.bfCompare?.bruteForce || null,
          cnt: 0,
          state: StressTestState.inactive,
        },
        timeElapsedMs: problem.timeElapsed,
        overrides: {
          timeLimitMs: problem.timeLimit,
          memoryLimitMb: problem.memoryLimit,
          compiler: problem.compilationSettings?.compiler,
          compilerArgs: problem.compilationSettings?.compilerArgs,
          runner: problem.compilationSettings?.runner,
          runnerArgs: problem.compilationSettings?.runnerArgs,
        },
      };
    },
    '0.4.3': (problem: History.IProblem_0_4_3): History.IProblem_0_4_8 => {
      return {
        ...problem,
        tcs: Object.fromEntries(
          Object.entries(problem.tcs).map(([testcaseId, testcase]: [string, any]) => [
            testcaseId,
            {
              ...testcase,
              stdin: testcase.stdin.useFile
                ? {
                    useFile: true,
                    data: testcase.stdin.path,
                  }
                : {
                    useFile: false,
                    data: testcase.stdin.data,
                  },
              answer: testcase.answer.useFile
                ? {
                    useFile: true,
                    data: testcase.answer.path,
                  }
                : {
                    useFile: false,
                    data: testcase.answer.data,
                  },
              result: undefined,
            },
          ]),
        ),
        version: '0.4.8',
      };
    },
    '0.3.7': (problem: History.IProblem_0_3_7): History.IProblem_0_4_3 =>
      ({
        ...problem,
        version: '0.4.3',
        tcs: Object.fromEntries(
          Object.entries(problem.tcs).map(([testcaseId, testcase]: [string, any]) => [
            testcaseId,
            { ...testcase, isDisabled: false },
          ]),
        ),
      }) satisfies History.IProblem_0_4_3,
    '0.2.4': (problem: History.IProblem_0_2_4): History.IProblem_0_3_7 => {
      const newProblem: History.IProblem_0_3_7 = {
        ...problem,
        version: '0.3.7',
        tcs: {},
        tcOrder: [],
      };
      for (const testcase of problem.tcs) {
        const testcaseId = this.crypto.randomUUID();
        newProblem.tcs[testcaseId] = testcase;
        newProblem.tcOrder.push(testcaseId);
      }
      return newProblem;
    },
    '0.2.3': (problem: History.IProblem_0_2_3): History.IProblem_0_2_4 =>
      ({
        ...problem,
        version: '0.2.4',
      }) satisfies History.IProblem_0_2_4,
    '0.2.1': (problem: History.IProblem_0_2_1): History.IProblem_0_2_3 =>
      ({
        ...problem,
        version: '0.2.3',
      }) satisfies History.IProblem_0_2_3,
    '0.1.1': (problem: History.IProblem_0_1_1): History.IProblem_0_2_1 =>
      ({
        ...problem,
        memoryLimit: 1024,
        timeElapsed: 0,
        version: '0.2.1',
      }) satisfies History.IProblem_0_2_1,
    '0.1.0': (problem: History.IProblem_0_1_0): History.IProblem_0_1_1 =>
      ({
        ...problem,
        version: '0.1.1',
      }) satisfies History.IProblem_0_1_1,
    '0.0.5': (problem: History.IProblem_0_0_5): History.IProblem_0_1_0 =>
      ({
        ...problem,
        src: {
          path: problem.srcPath,
          hash: problem.srcHash,
        },
        checker:
          problem.isSpecialJudge && problem.checkerPath
            ? {
                path: problem.checkerPath,
                hash: problem.checkerHash,
              }
            : undefined,
      }) satisfies History.IProblem_0_1_0,
    '0.0.4': (problem: History.IProblem_0_0_4): History.IProblem_0_0_5 =>
      ({
        ...problem,
        tcs: problem.testCases.map((testcase: any) => ({
          ...testcase,
          result: testcase.result
            ? {
                verdict: testcase.result.verdict,
                time: testcase.result.time,
                stdout: testcase.result.stdout,
                stderr: testcase.result.stderr,
                msg: testcase.result.message,
              }
            : undefined,
        })),
      }) satisfies History.IProblem_0_0_5,
    '0.0.3': (problem: History.IProblem_0_0_3): History.IProblem_0_0_4 =>
      ({
        ...problem,
        testCases: problem.testCases.map((testcase: any) => ({
          stdin: testcase.inputFile
            ? { useFile: true, path: testcase.input }
            : { useFile: false, data: testcase.input },
          answer: testcase.answerFile
            ? { useFile: true, path: testcase.answer }
            : { useFile: false, data: testcase.answer },
          result:
            testcase.status && testcase.time !== undefined
              ? {
                  verdict: testcase.status,
                  time: testcase.time,
                  stdout:
                    testcase.outputFile && testcase.output
                      ? { useFile: true, path: testcase.output }
                      : { useFile: false, data: testcase.output || '' },
                  stderr: { useFile: false, data: testcase.error || '' },
                  message: testcase.message || '',
                }
              : undefined,
          isExpand: testcase.isExpand,
        })),
      }) satisfies History.IProblem_0_0_4,
    '0.0.1': (problem: History.IProblem_0_0_1): History.IProblem_0_0_3 =>
      problem satisfies History.IProblem_0_0_3,
  };

  public migrate(problem: any): any {
    this.logger.trace('Starting migration', { originalVersion: problem.version });

    let currentData = problem;

    while (true) {
      const detectedVer = this.detectVersion(currentData);
      this.logger.debug('Detected version', detectedVer);

      const migrator = this.migrateFunctions[detectedVer];
      if (!migrator) break;

      const nextData = migrator(currentData);
      if (nextData === null) break;

      currentData = nextData;
      this.logger.trace('Migrated to version', currentData.version);
    }

    return currentData;
  }

  private detectVersion(problem: any): string {
    if ('version' in problem) {
      const versions = Object.keys(this.migrateFunctions).sort((a, b) => compare(b, a));
      for (const version of versions) {
        if (lte(version, problem.version)) {
          return version;
        }
      }
      return problem.version;
    }
    if ('src' in problem) {
      return '0.1.0';
    }
    if ('tcs' in problem) {
      return '0.0.5';
    }
    if ('testCases' in problem) {
      const firstTestCase = problem.testCases[0];
      if (firstTestCase) {
        if ('stdin' in firstTestCase) {
          return '0.0.4';
        }
        if ('message' in firstTestCase) {
          return '0.0.3';
        }
        return '0.0.1';
      }
      return '0.0.3';
    }
    return '0.0.1';
  }
}

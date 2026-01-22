// Copyright (C) 2026 Langning ChenProblem_0_4_8
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
import { BfCompareState } from '@/domain/entities/bfCompare';
import type { VerdictName } from '@/domain/entities/verdict';

@injectable()
export class ProblemMigrationService implements IProblemMigrationService {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
  ) {
    this.logger = this.logger.withScope('Migration');
  }

  private readonly migrateFunctions: Record<string, (oldProblem: any) => any> = {
    '0.6.0': (_: History.Problem_0_6_0): null => null,
    '0.4.8': (problem: History.Problem_0_4_8): History.Problem_0_6_0 => {
      const tcs: History.Problem_0_6_0['tcs'] = {};
      for (const id of problem.tcOrder) {
        const tc = problem.tcs[id];
        const migrateTcIo = (tcIo: History.TcIo_0_4_8): History.TcIo_0_6_0 => {
          if (tcIo.useFile) return { path: tcIo.data };
          return { data: tcIo.data };
        };
        if (tc)
          tcs[id] = {
            stdin: migrateTcIo(tc.stdin),
            answer: migrateTcIo(tc.answer),
            isExpand: tc.isExpand,
            isDisabled: tc.isDisabled,
            result: tc.result
              ? {
                  verdict: tc.result.verdict.name as VerdictName,
                  timeMs: tc.result.time,
                  memoryMb: tc.result.memory,
                  stdout: migrateTcIo(tc.result.stdout),
                  stderr: migrateTcIo(tc.result.stderr),
                  msg: tc.result.msg.join('\n'),
                }
              : undefined,
          };
      }

      return {
        version: '0.6.0',
        name: problem.name,
        url: problem.url,
        tcs,
        tcOrder: problem.tcOrder,
        src: problem.src,
        checker: problem.checker,
        interactor: problem.interactor,
        bfCompare: {
          generator: problem.bfCompare?.generator,
          bruteForce: problem.bfCompare?.bruteForce,
          cnt: 0,
          state: BfCompareState.inactive,
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
    '0.4.3': (problem: History.Problem_0_4_3): History.Problem_0_4_8 => {
      return {
        ...problem,
        tcs: Object.fromEntries(
          Object.entries(problem.tcs).map(([id, tc]: [string, any]) => [
            id,
            {
              ...tc,
              stdin: tc.stdin.useFile
                ? {
                    useFile: true,
                    data: tc.stdin.path,
                  }
                : {
                    useFile: false,
                    data: tc.stdin.data,
                  },
              answer: tc.answer.useFile
                ? {
                    useFile: true,
                    data: tc.answer.path,
                  }
                : {
                    useFile: false,
                    data: tc.answer.data,
                  },
              result: undefined,
            },
          ]),
        ),
        version: '0.4.8',
      };
    },
    '0.3.7': (problem: History.Problem_0_3_7): History.Problem_0_4_3 =>
      ({
        ...problem,
        version: '0.4.3',
        tcs: Object.fromEntries(
          Object.entries(problem.tcs).map(([id, tc]: [string, any]) => [
            id,
            { ...tc, isDisabled: false },
          ]),
        ),
      }) satisfies History.Problem_0_4_3,
    '0.2.4': (problem: History.Problem_0_2_4): History.Problem_0_3_7 => {
      const newProblem: History.Problem_0_3_7 = {
        ...problem,
        version: '0.3.7',
        tcs: {},
        tcOrder: [],
      };
      for (const tc of problem.tcs) {
        const id = this.crypto.randomUUID();
        newProblem.tcs[id] = tc;
        newProblem.tcOrder.push(id);
      }
      return newProblem;
    },
    '0.2.3': (problem: History.Problem_0_2_3): History.Problem_0_2_4 =>
      ({
        ...problem,
        version: '0.2.4',
      }) satisfies History.Problem_0_2_4,
    '0.2.1': (problem: History.Problem_0_2_1): History.Problem_0_2_3 =>
      ({
        ...problem,
        version: '0.2.3',
      }) satisfies History.Problem_0_2_3,
    '0.1.1': (problem: History.Problem_0_1_1): History.Problem_0_2_1 =>
      ({
        ...problem,
        memoryLimit: 1024,
        timeElapsed: 0,
        version: '0.2.1',
      }) satisfies History.Problem_0_2_1,
    '0.1.0': (problem: History.Problem_0_1_0): History.Problem_0_1_1 =>
      ({
        ...problem,
        version: '0.1.1',
      }) satisfies History.Problem_0_1_1,
    '0.0.5': (problem: History.Problem_0_0_5): History.Problem_0_1_0 =>
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
      }) satisfies History.Problem_0_1_0,
    '0.0.4': (problem: History.Problem_0_0_4): History.Problem_0_0_5 =>
      ({
        ...problem,
        tcs: problem.testCases.map((tc: any) => ({
          ...tc,
          result: tc.result
            ? {
                verdict: tc.result.verdict,
                time: tc.result.time,
                stdout: tc.result.stdout,
                stderr: tc.result.stderr,
                msg: tc.result.message,
              }
            : undefined,
        })),
      }) satisfies History.Problem_0_0_5,
    '0.0.3': (problem: History.Problem_0_0_3): History.Problem_0_0_4 =>
      ({
        ...problem,
        testCases: problem.testCases.map((tc: any) => ({
          stdin: tc.inputFile
            ? { useFile: true, path: tc.input }
            : { useFile: false, data: tc.input },
          answer: tc.answerFile
            ? { useFile: true, path: tc.answer }
            : { useFile: false, data: tc.answer },
          result:
            tc.status && tc.time !== undefined
              ? {
                  verdict: tc.status,
                  time: tc.time,
                  stdout:
                    tc.outputFile && tc.output
                      ? { useFile: true, path: tc.output }
                      : { useFile: false, data: tc.output || '' },
                  stderr: { useFile: false, data: tc.error || '' },
                  message: tc.message || '',
                }
              : undefined,
          isExpand: tc.isExpand,
        })),
      }) satisfies History.Problem_0_0_4,
    '0.0.1': (problem: History.Problem_0_0_1): History.Problem_0_0_3 =>
      problem satisfies History.Problem_0_0_3,
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

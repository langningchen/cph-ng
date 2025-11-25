// Copyright (C) 2025 Langning Chen
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

import Logger from '@/helpers/logger';
import { randomUUID } from 'crypto';
import { compare, lte } from 'semver';
import { Problem as Problem_0_0_1 } from './history/0.0.1';
import { Problem as Problem_0_0_3 } from './history/0.0.3';
import { Problem as Problem_0_0_4 } from './history/0.0.4';
import { Problem as Problem_0_0_5 } from './history/0.0.5';
import { Problem as Problem_0_1_0 } from './history/0.1.0';
import { Problem as Problem_0_1_1 } from './history/0.1.1';
import { Problem as Problem_0_2_1 } from './history/0.2.1';
import { Problem as Problem_0_2_3 } from './history/0.2.3';
import { Problem as Problem_0_2_4 } from './history/0.2.4';
import { Problem as Problem_0_3_7 } from './history/0.3.7';
import { Problem as Problem_0_4_3 } from './history/0.4.3';
import { IProblem, IProblem as Problem_0_4_8 } from './types';
import { Problem } from './types.backend';

const logger = new Logger('migration');

export type OldProblem =
    | Problem_0_4_8
    | Problem_0_4_3
    | Problem_0_3_7
    | Problem_0_2_4
    | Problem_0_2_3
    | Problem_0_2_1
    | Problem_0_1_1
    | Problem_0_1_0
    | Problem_0_0_5
    | Problem_0_0_4
    | Problem_0_0_3
    | Problem_0_0_1;

const migrateFunctions: Record<string, (oldProblem: any) => any> = {
    '0.4.8': (_: Problem_0_4_8): null => null,
    '0.4.3': (problem: Problem_0_4_3): Problem_0_4_8 => {
        return {
            ...problem,
            tcs: Object.fromEntries(
                Object.entries(problem.tcs).map(([id, tc]) => [
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
    '0.3.7': (problem: Problem_0_3_7): Problem_0_4_3 =>
        ({
            ...problem,
            version: '0.4.3',
            tcs: Object.fromEntries(
                Object.entries(problem.tcs).map(([id, tc]) => [
                    id,
                    { ...tc, isDisabled: false },
                ]),
            ),
        }) satisfies Problem_0_4_3,
    '0.2.4': (problem: Problem_0_2_4): Problem_0_3_7 => {
        const newProblem: Problem_0_3_7 = {
            ...problem,
            version: '0.3.7',
            tcs: {},
            tcOrder: [],
        };
        for (const tc of problem.tcs) {
            const id = randomUUID();
            newProblem.tcs[id] = tc;
            newProblem.tcOrder.push(id);
        }
        return newProblem;
    },
    '0.2.3': (problem: Problem_0_2_3): Problem_0_2_4 =>
        ({
            ...problem,
            version: '0.2.4',
        }) satisfies Problem_0_2_4,
    '0.2.1': (problem: Problem_0_2_1): Problem_0_2_3 =>
        ({
            ...problem,
            version: '0.2.3',
        }) satisfies Problem_0_2_3,
    '0.1.1': (problem: Problem_0_1_1): Problem_0_2_1 =>
        ({
            ...problem,
            memoryLimit: 1024,
            timeElapsed: 0,
            version: '0.2.1',
        }) satisfies Problem_0_2_1,
    '0.1.0': (problem: Problem_0_1_0): Problem_0_1_1 =>
        ({
            ...problem,
            version: '0.1.1',
        }) satisfies Problem_0_1_1,
    '0.0.5': (problem: Problem_0_0_5): Problem_0_1_0 =>
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
        }) satisfies Problem_0_1_0,
    '0.0.4': (problem: Problem_0_0_4): Problem_0_0_5 =>
        ({
            ...problem,
            tcs: problem.testCases.map((tc) => ({
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
        }) satisfies Problem_0_0_5,
    '0.0.3': (problem: Problem_0_0_3): Problem_0_0_4 =>
        ({
            ...problem,
            testCases: problem.testCases.map((tc) => ({
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
                              stdout: tc.outputFile
                                  ? { useFile: true, path: tc.output! }
                                  : { useFile: false, data: tc.output || '' },
                              stderr: { useFile: false, data: tc.error || '' },
                              message: tc.message || '',
                          }
                        : undefined,
                isExpand: tc.isExpand,
            })),
        }) satisfies Problem_0_0_4,
    '0.0.1': (problem: Problem_0_0_1): Problem_0_0_3 =>
        problem satisfies Problem_0_0_3,
};

export const migration = (problem: OldProblem): Problem => {
    logger.trace('Starting migration', problem);
    while (true) {
        const detectedVer: string = (() => {
            const problemAny = problem as any;
            if ('version' in problemAny) {
                const versions = Object.keys(migrateFunctions).sort((a, b) =>
                    compare(b, a),
                );
                for (const version of versions) {
                    if (lte(version, problemAny.version)) {
                        return version;
                    }
                }
                return problemAny.version;
            }
            if ('src' in problemAny) {
                return '0.1.0';
            }
            if ('tcs' in problemAny) {
                return '0.0.5';
            }
            if ('testCases' in problemAny) {
                const firstTestCase = problemAny.testCases[0];
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
        })();
        logger.debug('Detected version', detectedVer);
        let newProblem = migrateFunctions[detectedVer](problem);
        if (newProblem === null) {
            break;
        }
        problem = newProblem;
        logger.trace('Migrated to version', problem);
    }
    return Problem.fromI(problem as unknown as IProblem);
};

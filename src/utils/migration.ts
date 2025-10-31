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

import Logger from '../helpers/logger';
import { Problem, Problem as Problem_0_2_4 } from './types';
import { Problem as Problem_0_0_1 } from './types/0.0.1';
import { Problem as Problem_0_0_3 } from './types/0.0.3';
import { Problem as Problem_0_0_4 } from './types/0.0.4';
import { Problem as Problem_0_0_5 } from './types/0.0.5';
import { Problem as Problem_0_1_0 } from './types/0.1.0';
import { Problem as Problem_0_1_1 } from './types/0.1.1';
import { Problem as Problem_0_2_1 } from './types/0.2.1';
import { Problem as Problem_0_2_3 } from './types/0.2.3';

const logger = new Logger('migration');

export type OldProblem =
    | Problem_0_2_3
    | Problem_0_2_1
    | Problem_0_1_1
    | Problem_0_1_0
    | Problem_0_0_5
    | Problem_0_0_4
    | Problem_0_0_3
    | Problem_0_0_1;

const migrateFunctions: Record<string, (oldProblem: any) => any> = {
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
    logger.trace('Starting migration', { problem });
    while (true) {
        const version: string = (() => {
            const problemAny = problem as any;
            if ('version' in problemAny) {
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
        logger.debug('Detected version', { version });
        if (migrateFunctions[version] === undefined) {
            logger.debug('No migration function found, stopping migration');
            break;
        }
        problem = migrateFunctions[version](problem);
        logger.debug('Migrated to version', { version, problem });
    }
    return problem as Problem;
};

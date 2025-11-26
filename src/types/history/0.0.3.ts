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

export interface TestCaseStatus {
    name: string;
    fullName: string;
    color: string;
}

export interface TestCase {
    input: string;
    inputFile: boolean;
    answer: string;
    answerFile: boolean;
    output?: string;
    outputFile?: boolean;
    error?: string;
    status?: TestCaseStatus;
    message?: string;
    time?: number;
    isExpand: boolean;
}

export interface Problem {
    name: string;
    url?: string;
    testCases: TestCase[];
    timeLimit: number;
    srcPath: string;
    srcHash?: string;
    isSpecialJudge?: boolean;
    checkerPath?: string;
    checkerHash?: string;
}

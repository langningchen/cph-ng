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

export interface TCVerdict {
    name: string;
    fullName: string;
    color: string;
}

export type TCIO =
    | { useFile: true; path: string }
    | { useFile: false; data: string };

export interface TCResult {
    verdict: TCVerdict;
    memory?: number;
    time: number;
    stdout: TCIO;
    stderr: TCIO;
    msg: string;
}

export interface TC {
    stdin: TCIO;
    answer: TCIO;
    isExpand: boolean;
    result?: TCResult;
}

export interface FileWithHash {
    path: string;
    hash?: string;
}

export interface BFCompare {
    generator?: FileWithHash;
    bruteForce?: FileWithHash;
    running: boolean;
    msg: string;
}

export interface CompilationSettings {
    compiler?: string;
    compilerArgs?: string;
    runner?: string;
    runnerArgs?: string;
}

export interface Problem {
    version: string;
    name: string;
    url?: string;
    tcs: TC[];
    timeLimit: number;
    memoryLimit: number;
    src: FileWithHash;
    checker?: FileWithHash;
    interactor?: FileWithHash;
    bfCompare?: BFCompare;
    timeElapsed: number;
    compilationSettings?: CompilationSettings;
}

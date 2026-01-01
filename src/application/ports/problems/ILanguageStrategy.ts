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

import type { FileWithHash, IOverwrites } from '@/types';

export interface CompileAdditionalData {
  canUseWrapper: boolean;
  overwrites?: IOverwrites;
}

export interface LangCompileData {
  path: string;
  hash?: string;
}

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

export class CompileRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileRejected';
  }
}

export type LangCompileResult = LangCompileData | CompileError | CompileRejected | Error;

export interface ILanguageStrategy {
  readonly name: string;
  readonly extensions: string[];
  readonly enableRunner: boolean;

  compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData?: CompileAdditionalData,
  ): Promise<LangCompileResult>;

  getRunCommand(target: string, overwrites?: IOverwrites): Promise<string[]>;
}

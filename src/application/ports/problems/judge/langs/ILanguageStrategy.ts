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

import type { IFileWithHash, IOverrides } from '@/domain/types';

export interface CompileAdditionalData {
  canUseWrapper: boolean;
  overrides?: IOverrides;
}

export interface LangCompileData {
  path: string;
  hash?: string;
}

export interface ILanguageDefaultValues {
  compiler?: string;
  compilerArgs?: string;
  runner?: string;
  runnerArgs?: string;
}

export class CompileError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

export class CompileAborted extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CompileAborted';
  }
}

export type LangCompileResult = LangCompileData | CompileError | CompileAborted | Error;

export interface ILanguageStrategy {
  readonly name: string;
  readonly extensions: string[];
  readonly enableRunner: boolean;
  readonly defaultValues: ILanguageDefaultValues;

  compile(
    src: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
    additionalData?: CompileAdditionalData,
  ): Promise<LangCompileResult>;

  getRunCommand(target: string, overrides?: IOverrides): Promise<string[]>;
}

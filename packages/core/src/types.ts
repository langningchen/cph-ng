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

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

declare const BrandSym: unique symbol;
export type Branded<T, Label> = T & { [BrandSym]?: Label };

export type ProblemId = Branded<Uuid, 'ProblemId'>;
export type TestcaseId = Branded<Uuid, 'TestcaseId'>;
export type ClientId = Branded<Uuid, 'ClientId'>;
export type BatchId = Branded<Uuid, 'BatchId'>;

export interface ToolchainItem {
  name: string;
  group: string;
  version: string | null;
  description?: string;
  path: string;
}
export interface ToolchainInfo {
  default: string | null;
  args?: string;
  list: ToolchainItem[];
}

export interface ILanguageEnv {
  compiler?: string;
  compilerArgs?: string;
  interpreter?: string;
  interpreterArgs?: string;
}

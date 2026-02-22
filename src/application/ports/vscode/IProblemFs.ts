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

import type TypedEventEmitter from 'typed-emitter';
import type { FileSystemProvider, Uri } from 'vscode';
import type { ProblemFsEvents } from '@/infrastructure/vscode/problemFs';

export interface IProblemFs extends FileSystemProvider {
  signals: TypedEventEmitter<ProblemFsEvents>;
  getUri(srcPath: string, path: string): Uri;
}

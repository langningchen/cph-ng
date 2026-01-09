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

import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { Problem } from '@/domain/entities/problem';

const getRenderer = (): IPathResolver => {
  return container.resolve<IPathResolver>(TOKENS.PathResolver);
};

/**
 * @deprecated Use new DI IPathResolver
 */
export const renderTemplate = async (problem: Problem): Promise<string> => {
  return getRenderer().renderTemplate(problem);
};

/**
 * @deprecated Use new DI IPathResolver
 */
export const renderPath = (original: string): string => {
  return getRenderer().renderPath(original);
};

/**
 * @deprecated Use new DI IPathResolver
 */
export const renderWorkspacePath = async (original: string): Promise<string | null> => {
  return getRenderer().renderWorkspacePath(original);
};

/**
 * @deprecated Use new DI IPathResolver
 */
export const renderPathWithFile = (
  original: string,
  path: string,
  ignoreError: boolean = false,
): string | null => {
  return getRenderer().renderPathWithFile(original, path, ignoreError);
};

/**
 * @deprecated Use new DI IPathResolver
 */
export const renderUnzipFolder = (srcPath: string, zipPath: string): string | null => {
  return getRenderer().renderUnzipFolder(srcPath, zipPath);
};

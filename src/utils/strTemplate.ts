import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '../types/types.backend';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';

const getRenderer = (): IPathResolver => {
  return container.resolve<IPathResolver>(TOKENS.PathRenderer);
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

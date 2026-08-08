import type { IPath } from '@/application/ports/node/IPath';
import type { SystemPlatform } from '@/application/ports/node/ISystem';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';

export const normalizeFileName = (fileName: string, ext: string, path: IPath): string => {
  const inputExt = path.extname(fileName);
  if (inputExt) fileName = path.basename(fileName, inputExt);
  return fileName + ext;
};

export const validateFileName = (
  fileName: string,
  path: IPath,
  translator: ITranslator,
  platform: SystemPlatform,
): string | null => {
  if (!fileName) return translator.t('File name must not be empty');
  if (fileName === '.' || fileName === '..') return translator.t('File name must not be . or ..');
  const hasControlCharacter = [...fileName].some((char) => char.charCodeAt(0) < 32);
  if (/[<>:"/\\|?*]/.test(fileName) || hasControlCharacter)
    return translator.t('File name must not contain invalid characters');
  if (/[. ]$/.test(fileName)) return translator.t('File name must not end with a dot or space');

  const baseName = path.basename(fileName, path.extname(fileName));
  if (platform === 'win32' && /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName))
    return translator.t('File name is reserved on Windows');
  return null;
};

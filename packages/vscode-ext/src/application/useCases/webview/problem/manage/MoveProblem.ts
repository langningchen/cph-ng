import type { MoveProblemMsg } from '@cph-ng/core';
import { Uri } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProblemCopyService } from '@/application/ports/problems/IProblemCopyService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';

export interface MoveProblemDeps {
  repo: IProblemRepository;
  coordinator: IActiveProblemCoordinator;
  fs: IFileSystem;
  path: IPath;
  copyService: IProblemCopyService;
  service: IProblemService;
  translator: ITranslator;
  ui: IUi;
}

function validateFileName(fileName: string, translator: ITranslator, path: IPath): string | null {
  if (!fileName) return translator.t('File name must not be empty');
  if (fileName === '.' || fileName === '..') return translator.t('File name must not be . or ..');
  const hasControlCharacter = [...fileName].some((char) => char.charCodeAt(0) < 32);
  if (/[<>:"/\\|?*]/.test(fileName) || hasControlCharacter)
    return translator.t('File name must not contain invalid characters');
  if (/[. ]$/.test(fileName)) return translator.t('File name must not end with a dot or space');

  const baseName = path.basename(fileName, path.extname(fileName));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName))
    return translator.t('File name is reserved on Windows');
  return null;
}

export async function moveProblem(deps: MoveProblemDeps, msg: MoveProblemMsg): Promise<void> {
  const { repo, coordinator, fs, path, copyService, service, translator, ui } = deps;
  const backgroundProblem = await repo.get(msg.problemId);
  if (!backgroundProblem) throw new Error('Problem not found');
  backgroundProblem.abort();
  const { problemId, problem } = backgroundProblem;
  const srcPath = problem.src.path;
  const ext = path.extname(srcPath);
  const defaultName = path.basename(srcPath, ext);

  const folder = await ui.openDialog({
    title: translator.t('Choose a folder to move the problem to'),
    canSelectFolders: true,
    canSelectFiles: false,
    defaultPath: path.dirname(srcPath),
  });
  if (folder === undefined) return;

  const input = await ui.input({
    prompt: translator.t('New file name (defaults to current name)'),
    value: defaultName,
  });
  if (input === undefined) return;

  let fileName = input.trim();
  const validationError = validateFileName(fileName, translator, path);
  if (validationError) throw new Error(validationError);

  const inputExt = path.extname(fileName);
  if (inputExt) fileName = path.basename(fileName, inputExt);
  fileName += ext;
  const destSrcPath = path.join(folder, fileName);
  if (destSrcPath === srcPath)
    throw new Error(translator.t('The new file name must be different'));
  if (await fs.exists(destSrcPath))
    throw new Error(translator.t('File already exists: {fileName}', { fileName }));

  await copyService.copy(problem, destSrcPath);

  await repo.unload(problemId);
  await service.delete(problem);

  await fs.rm(srcPath, { force: true });

  ui.openFile(Uri.file(destSrcPath));
  await coordinator.onActiveEditorChanged();
  await coordinator.dispatchFullData();
}

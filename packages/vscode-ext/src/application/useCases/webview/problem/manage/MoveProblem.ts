import type { MoveProblemMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import { Uri } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { IProblemCopyService } from '@/application/ports/problems/IProblemCopyService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { BaseProblemUseCase } from '@/application/useCases/webview/problem/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';

@injectable()
export class MoveProblem extends BaseProblemUseCase<MoveProblemMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) protected readonly repo: IProblemRepository,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemCopyService) private readonly copyService: IProblemCopyService,
    @inject(TOKENS.problemService) private readonly service: IProblemService,
    @inject(TOKENS.system) private readonly system: ISystem,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
  ) {
    super(repo);
  }

  protected async performAction(
    backgroundProblem: BackgroundProblem,
    _msg: MoveProblemMsg,
  ): Promise<void> {
    backgroundProblem.abort();
    const { problemId, problem } = backgroundProblem;
    const srcPath = problem.src.path;
    const ext = this.path.extname(srcPath);
    const defaultName = this.path.basename(srcPath, ext);

    const folder = await this.ui.openDialog({
      title: this.translator.t('Choose a folder to move the problem to'),
      canSelectFolders: true,
      canSelectFiles: false,
      defaultPath: this.path.dirname(srcPath),
    });
    if (folder === undefined) return;

    const input = await this.ui.input({
      prompt: this.translator.t('New file name (defaults to current name)'),
      value: defaultName,
    });
    if (input === undefined) return;

    let fileName = input.trim();
    const validationError = this.validateFileName(fileName);
    if (validationError) throw new Error(validationError);

    const inputExt = this.path.extname(fileName);
    if (inputExt) fileName = this.path.basename(fileName, inputExt);
    fileName += ext;
    const destSrcPath = this.path.join(folder, fileName);
    if (destSrcPath === srcPath)
      throw new Error(this.translator.t('The new file name must be different'));
    if (await this.fs.exists(destSrcPath))
      throw new Error(this.translator.t('File already exists: {fileName}', { fileName }));

    await this.copyService.copy(problem, destSrcPath);

    await this.repo.unload(problemId);
    await this.service.delete(problem);

    await this.fs.rm(srcPath, { force: true });

    this.ui.openFile(Uri.file(destSrcPath));
    await this.coordinator.onActiveEditorChanged();
    await this.coordinator.dispatchFullData();
  }

  private validateFileName(fileName: string): string | null {
    if (!fileName) return this.translator.t('File name must not be empty');
    if (fileName === '.' || fileName === '..')
      return this.translator.t('File name must not be . or ..');
    const hasControlCharacter = [...fileName].some((char) => char.charCodeAt(0) < 32);
    if (/[<>:"/\\|?*]/.test(fileName) || hasControlCharacter)
      return this.translator.t('File name must not contain invalid characters');
    if (/[. ]$/.test(fileName))
      return this.translator.t('File name must not end with a dot or space');

    const baseName = this.path.basename(fileName, this.path.extname(fileName));
    if (
      this.system.platform() === 'win32' &&
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName)
    )
      return this.translator.t('File name is reserved on Windows');
    return null;
  }
}

import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { systemMock } from '@t/infrastructure/node/systemMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IProblemCopyService } from '@/application/ports/problems/IProblemCopyService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { MoveProblem } from '@/application/useCases/webview/problem/manage/MoveProblem';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { Problem } from '@/domain/entities/problem';

vi.mock('vscode', () => ({
  // biome-ignore lint/style/useNamingConvention: vscode module namespace
  Uri: {
    file: (path: string) => ({ scheme: 'file', path, fsPath: path }),
  },
}));

const PROBLEM_ID = '00000000-0000-0000-0000-000000000000';

describe('MoveProblem', () => {
  let service: MoveProblem;
  let repoMock: MockProxy<IProblemRepository>;
  let coordinatorMock: MockProxy<IActiveProblemCoordinator>;
  let fileSystemMock: ReturnType<typeof createFileSystemMock>['fileSystemMock'];
  let copyServiceMock: MockProxy<IProblemCopyService>;
  let serviceMock: MockProxy<IProblemService>;
  let uiMock: MockProxy<IUi>;
  let background: BackgroundProblem;

  beforeEach(() => {
    systemMock.platform.mockReturnValue('linux');
    repoMock = mock<IProblemRepository>();
    coordinatorMock = mock<IActiveProblemCoordinator>();
    fileSystemMock = createFileSystemMock().fileSystemMock;
    copyServiceMock = mock<IProblemCopyService>();
    serviceMock = mock<IProblemService>();
    serviceMock.move = undefined;
    repoMock.save = vi.fn().mockResolvedValue(undefined);
    uiMock = mock<IUi>();

    const problem = new Problem('main', '/src/main.cpp');
    background = new BackgroundProblem(PROBLEM_ID, problem, Date.now());
    repoMock.get.mockResolvedValue(background);
    repoMock.unload.mockResolvedValue(true);
    serviceMock.delete.mockResolvedValue();
    copyServiceMock.copy.mockResolvedValue(background.problem);
    uiMock.openDialog.mockResolvedValue('/newdir');
    uiMock.input.mockResolvedValue('main');
    uiMock.openFile.mockImplementation(() => {});
    coordinatorMock.onActiveEditorChanged.mockResolvedValue();
    coordinatorMock.dispatchFullData.mockResolvedValue();

    service = new MoveProblem(
      coordinatorMock,
      fileSystemMock,
      pathMock,
      copyServiceMock,
      repoMock,
      serviceMock,
      systemMock,
      translatorMock,
      uiMock,
    );
  });

  const exec = () => service.exec({ type: 'moveProblem', problemId: PROBLEM_ID });

  async function kernelMove() {
    await fileSystemMock.safeWriteFile('/src/main.cpp', 'source');
    serviceMock.move = vi.fn(async (problem, destination) => {
      problem.src.path = destination;
    });
    return serviceMock.move;
  }

  it('moves through the kernel while preserving the problem identity', async () => {
    await kernelMove();
    await exec();
    expect(serviceMock.move).toHaveBeenCalledWith(background.problem, '/newdir/main.cpp');
    expect(fileSystemMock.copyFile).toHaveBeenCalledWith('/src/main.cpp', '/newdir/main.cpp', true);
    expect(await fileSystemMock.readFile('/newdir/main.cpp')).toBe('source');
    expect(await fileSystemMock.exists('/src/main.cpp')).toBe(false);
    expect(serviceMock.delete).not.toHaveBeenCalled();
    expect(copyServiceMock.copy).not.toHaveBeenCalled();
  });

  it('removes its new file if the kernel refuses the move', async () => {
    const move = await kernelMove();
    vi.mocked(move).mockRejectedValueOnce(new Error('move failed'));
    await expect(exec()).rejects.toThrow('move failed');
    expect(await fileSystemMock.readFile('/src/main.cpp')).toBe('source');
    expect(await fileSystemMock.exists('/newdir/main.cpp')).toBe(false);
    expect(repoMock.unload).not.toHaveBeenCalled();
  });

  it('restores the original binding when deleting the source fails', async () => {
    await kernelMove();
    fileSystemMock.rm.mockRejectedValueOnce(new Error('source is busy'));
    await expect(exec()).rejects.toThrow('source is busy');
    expect(serviceMock.move).toHaveBeenLastCalledWith(background.problem, '/src/main.cpp');
    expect(background.problem.src.path).toBe('/src/main.cpp');
    expect(await fileSystemMock.readFile('/src/main.cpp')).toBe('source');
    expect(await fileSystemMock.exists('/newdir/main.cpp')).toBe(false);
    expect(repoMock.unload).not.toHaveBeenCalled();
  });

  it('retains both sources when restoring the binding also fails', async () => {
    const move = await kernelMove();
    fileSystemMock.rm.mockRejectedValueOnce(new Error('source is busy'));
    vi.mocked(move)
      .mockImplementationOnce(async (problem, destination) => {
        problem.src.path = destination;
      })
      .mockRejectedValueOnce(new Error('restore failed'));
    await expect(exec()).rejects.toThrow('restore failed');
    expect(await fileSystemMock.readFile('/src/main.cpp')).toBe('source');
    expect(await fileSystemMock.readFile('/newdir/main.cpp')).toBe('source');
    expect(background.problem.src.path).toBe('/newdir/main.cpp');
    expect(repoMock.unload).not.toHaveBeenCalled();
  });

  it('moves the problem to the chosen folder', async () => {
    await exec();

    expect(uiMock.openDialog).toHaveBeenCalledWith(
      expect.objectContaining({ canSelectFolders: true, defaultPath: '/src' }),
    );
    expect(copyServiceMock.copy).toHaveBeenCalledWith(background.problem, '/newdir/main.cpp');
    expect(repoMock.unload).toHaveBeenCalledWith(PROBLEM_ID);
    expect(serviceMock.delete).toHaveBeenCalledWith(background.problem);
    expect(fileSystemMock.rm).toHaveBeenCalledWith('/src/main.cpp', { force: true });
    expect(uiMock.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ scheme: 'file', path: '/newdir/main.cpp' }),
    );
    expect(coordinatorMock.onActiveEditorChanged).toHaveBeenCalled();
    expect(coordinatorMock.dispatchFullData).toHaveBeenCalled();
  });

  it('does nothing when the folder dialog is cancelled', async () => {
    uiMock.openDialog.mockResolvedValue(undefined);

    await exec();

    expect(copyServiceMock.copy).not.toHaveBeenCalled();
    expect(serviceMock.delete).not.toHaveBeenCalled();
    expect(fileSystemMock.rm).not.toHaveBeenCalled();
  });

  it('rejects moving to the same path', async () => {
    uiMock.openDialog.mockResolvedValue('/src');
    uiMock.input.mockResolvedValue('main');

    await expect(exec()).rejects.toThrow('The new file name must be different');
    expect(copyServiceMock.copy).not.toHaveBeenCalled();
  });

  it('rejects when the destination file already exists', async () => {
    fileSystemMock.exists.mockResolvedValue(true);

    await expect(exec()).rejects.toThrow('File already exists');
    expect(copyServiceMock.copy).not.toHaveBeenCalled();
  });

  it('rejects reserved file names only on Windows', async () => {
    systemMock.platform.mockReturnValue('win32');
    uiMock.input.mockResolvedValue('CON');
    await expect(exec()).rejects.toThrow('File name is reserved on Windows');
  });

  it('allows reserved file names on non-Windows platforms', async () => {
    uiMock.input.mockResolvedValue('CON');
    await expect(exec()).resolves.toBeUndefined();
  });
});

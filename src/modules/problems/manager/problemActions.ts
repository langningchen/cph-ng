import type * as msgs from '@w/msgs';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { basename, extname, join } from 'path';
import { commands, l10n, Uri, window } from 'vscode';
import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import Io from '@/helpers/io';
import Settings from '@/helpers/settings';
import Companion from '@/modules/companion';
import { Problem } from '@/types';
import { extensionPath } from '@/utils/global';
import { CphProblem } from '../cphProblem';
import ProblemFs from '../problemFs';

export class ProblemActions {
  public static async createProblem(msg: msgs.CreateProblemMsg): Promise<void> {
    const src = msg.activePath;
    if (!src) {
      Io.warn(l10n.t('No active editor found.'));
      return;
    }
    const binPath = await Problem.getBinBySrc(src);
    if (binPath && existsSync(binPath)) {
      Io.warn(l10n.t('Problem already exists for this file.'));
      return;
    }
    const problem = new Problem(basename(src, extname(src)), src);
    await problem.save();
    const repository = container.resolve(TOKENS.ProblemRepository);
    await repository.dataRefresh();
  }
  public static async importProblem(msg: msgs.ImportProblemMsg): Promise<void> {
    const src = msg.activePath;
    if (!src) {
      Io.warn(l10n.t('No active editor found.'));
      return;
    }
    const binPath = await Problem.getBinBySrc(src);
    if (binPath && existsSync(binPath)) {
      Io.warn(l10n.t('Problem already exists for this file.'));
      return;
    }
    const probFile = CphProblem.getProbBySrc(src);
    const problem = (await CphProblem.fromFile(probFile))?.toProblem();
    if (!problem) {
      Io.warn(l10n.t('Failed to load problem from CPH.'));
      return;
    }
    await problem.save();
    const repository = container.resolve(TOKENS.ProblemRepository);
    await repository.dataRefresh();
  }

  public static async editProblemDetails(msg: msgs.EditProblemDetailsMsg) {
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    fullProblem.problem.name = msg.title;
    fullProblem.problem.url = msg.url;
    fullProblem.problem.timeLimitMs = msg.timeLimit;
    fullProblem.problem.memoryLimitMb = msg.memoryLimit;
    fullProblem.problem.overrides = msg.overrides;
    await repository.dataRefresh(true);
  }
  public static async delProblem(msg: msgs.DelProblemMsg) {
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    await fullProblem.problem.del();
    repository.removeProblem(fullProblem);
    await repository.dataRefresh();
  }

  public static async chooseSrcFile(msg: msgs.ChooseSrcFileMsg): Promise<void> {
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }

    const checkerFileUri = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: l10n.t('Select {fileType} File', {
        fileType: {
          checker: l10n.t('Checker'),
          interactor: l10n.t('Interactor'),
          generator: l10n.t('Generator'),
          bruteForce: l10n.t('Brute Force'),
        }[msg.fileType],
      }),
    });
    if (!checkerFileUri) {
      return;
    }
    const path = checkerFileUri[0].fsPath;
    if (msg.fileType === 'checker') {
      fullProblem.problem.checker = { path };
    } else if (msg.fileType === 'interactor') {
      fullProblem.problem.interactor = { path };
    } else if (msg.fileType === 'generator') {
      if (!fullProblem.problem.bfCompare) {
        fullProblem.problem.bfCompare = { running: false, msg: '' };
      }
      fullProblem.problem.bfCompare.generator = { path };
    } else {
      if (!fullProblem.problem.bfCompare) {
        fullProblem.problem.bfCompare = { running: false, msg: '' };
      }
      fullProblem.problem.bfCompare.bruteForce = { path };
    }
    await repository.dataRefresh(true);
  }
  public static async removeSrcFile(msg: msgs.RemoveSrcFileMsg): Promise<void> {
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    if (msg.fileType === 'checker') {
      fullProblem.problem.checker = undefined;
    } else if (msg.fileType === 'interactor') {
      fullProblem.problem.interactor = undefined;
    } else if (msg.fileType === 'generator' && fullProblem.problem.bfCompare) {
      fullProblem.problem.bfCompare.generator = undefined;
    } else if (msg.fileType === 'bruteForce' && fullProblem.problem.bfCompare) {
      fullProblem.problem.bfCompare.bruteForce = undefined;
    }
    await repository.dataRefresh(true);
  }
  public static async submitToCodeforces(
    msg: msgs.SubmitToCodeforcesMsg,
  ): Promise<void> {
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    Companion.submit(fullProblem.problem);
  }
  public static async openFile(msg: msgs.OpenFileMsg): Promise<void> {
    if (!msg.isVirtual) {
      await commands.executeCommand(
        'vscode.open',
        Uri.file(msg.path),
        Settings.companion.showPanel,
      );
      return;
    }
    const repository = container.resolve(TOKENS.ProblemRepository);
    const fullProblem = await repository.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    await commands.executeCommand(
      'vscode.open',
      Uri.from({
        scheme: ProblemFs.scheme,
        authority: fullProblem.problem.src.path,
        path: msg.path,
      }),
      Settings.companion.showPanel,
    );
  }
  public static async openTestlib(_msg: msgs.OpenTestlibMsg): Promise<void> {
    const item = await window.showQuickPick(
      await readdir(join(extensionPath, 'dist', 'testlib')),
      {
        placeHolder: l10n.t('Select a file to open'),
      },
    );
    if (!item) {
      return;
    }
    await commands.executeCommand(
      'vscode.open',
      Uri.file(join(extensionPath, 'dist', 'testlib', item)),
      Settings.companion.showPanel,
    );
  }
}

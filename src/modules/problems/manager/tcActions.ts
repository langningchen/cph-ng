import type * as msgs from '@w/msgs';
import { stat, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { commands, l10n, Uri, window } from 'vscode';
import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import FolderChooser from '@/helpers/folderChooser';
import Io from '@/helpers/io';
import Settings from '@/helpers/settings';
import { Tc, TcIo } from '@/types';
import { generateTcUri } from '../problemFs';
import { ProblemActions } from './problemActions';

export class TcActions {
  private static getRepository() {
    return container.resolve(TOKENS.ProblemRepository);
  }
  
  public static async chooseTcFile(msg: msgs.ChooseTcFileMsg): Promise<void> {
    const fullProblem = await TcActions.getRepository().getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    const isInput = msg.label === 'stdin';
    const mainExt = isInput
      ? Settings.problem.inputFileExtensionList
      : Settings.problem.outputFileExtensionList;
    const fileUri = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: l10n.t('Choose {type} file', {
        type: isInput ? l10n.t('stdin') : l10n.t('answer'),
      }),
      filters: {
        [l10n.t('Text files')]: mainExt.map((ext) => ext.substring(1)),
        [l10n.t('All files')]: ['*'],
      },
    });
    if (!fileUri || !fileUri.length) {
      return;
    }
    const partialTc = await TcFactory.fromFile(fileUri[0].fsPath, isInput);
    partialTc.stdin &&
      (fullProblem.problem.tcs[msg.id].stdin = partialTc.stdin);
    partialTc.answer &&
      (fullProblem.problem.tcs[msg.id].answer = partialTc.answer);
    await TcActions.getRepository().dataRefresh();
  }

  public static async reorderTc(msg: msgs.ReorderTcMsg): Promise<void> {
    const fullProblem = await TcActions.getRepository().getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    const tcOrder = fullProblem.problem.tcOrder;
    const [movedTc] = tcOrder.splice(msg.fromIdx, 1);
    tcOrder.splice(msg.toIdx, 0, movedTc);
    await TcActions.getRepository().dataRefresh(true);
  }
  public static async dragDrop(msg: msgs.DragDropMsg): Promise<void> {
    // Try to get the problem, if not exist, create a new one
    let fullProblem = await TcActions.getRepository().getFullProblem(msg.activePath);
    if (!fullProblem) {
      await ProblemActions.createProblem({
        type: 'createProblem',
        activePath: msg.activePath,
      });
      fullProblem = await TcActions.getRepository().getFullProblem(msg.activePath);
      if (!fullProblem) {
        return;
      }
    }

    for (const item of msg.items) {
      if (
        await stat(item)
          .then((s) => s.isDirectory())
          .catch(() => false)
      ) {
        fullProblem.problem.applyTcs(await TcFactory.fromFolder(item));
        break;
      }
      const ext = extname(item).toLowerCase();
      if (ext === '.zip') {
        fullProblem.problem.applyTcs(
          await TcFactory.fromZip(fullProblem.problem.src.path, item),
        );
        break;
      }
      if (
        Settings.problem.inputFileExtensionList.includes(ext) ||
        Settings.problem.outputFileExtensionList.includes(ext)
      ) {
        const { stdin, answer } = await TcFactory.fromFile(item);
        fullProblem.problem.addTc(
          new Tc(stdin ?? new TcIo(), answer ?? new TcIo()),
        );
      }
    }
    await TcActions.getRepository().dataRefresh();
  }
}

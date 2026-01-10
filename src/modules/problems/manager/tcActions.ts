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
    return container.resolve(TOKENS.problemRepository);
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

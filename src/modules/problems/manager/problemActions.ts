import type * as msgs from '@w/msgs';
import { existsSync } from 'fs';
import { l10n } from 'vscode';
import { container } from 'tsyringe';
import { TOKENS } from '@/composition/tokens';
import Io from '@/helpers/io';
import { Problem } from '@/types';
import { CphProblem } from '../cphProblem';

export class ProblemActions {
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
    const repository = container.resolve(TOKENS.problemRepository);
    await repository.dataRefresh();
  }
}

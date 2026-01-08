import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { dirname } from 'path';
import {
  commands,
  l10n,
  QuickPick,
  QuickPickItem,
  Uri,
  window,
  workspace,
} from 'vscode';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import UserScriptManager from '@/helpers/userScriptManager';
import { Problem } from '@/types';
import { mkdirIfNotExists } from '@/utils/process';
import { renderTemplate } from '@/utils/strTemplate';
import { CphProblem } from '../problems/cphProblem';
import ProblemsManager from '../problems/manager';
import { CompanionClient } from './client';
import { CompanionProblem } from './types';

export class Handler {
  private static logger: Logger = new Logger('companionHandler');
  private static claimedBatches = new Set<string>();
  private static activeQuickPicks = new Map<string, QuickPick<QuickPickItem>>();

  public static handleBatchAvailable(
    batchId: string,
    problems: CompanionProblem[],
  ) {
    if (!problems || problems.length === 0) {
      window.showWarningMessage(
        l10n.t('No problems were received from Companion. Nothing to import.'),
      );
      return;
    }
    const quickPick = window.createQuickPick();
    quickPick.items = [{ label: l10n.t('Yes') }, { label: l10n.t('No') }];
    quickPick.placeholder = l10n.t(
      'Received {count} problems from Companion. Import here?',
      {
        count: problems.length,
      },
    );
    quickPick.ignoreFocusOut = true;

    quickPick.onDidAccept(async () => {
      const selection = quickPick.selectedItems[0];
      if (selection && selection.label === l10n.t('Yes')) {
        if (Handler.claimedBatches.has(batchId)) {
          Io.warn(l10n.t('Problems already imported by another instance'));
        } else {
          Handler.claimedBatches.add(batchId);
          CompanionClient.claimBatch(batchId);
          await Handler.processProblem(problems);
        }
      }
      quickPick.hide();
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
      Handler.activeQuickPicks.delete(batchId);
    });

    Handler.activeQuickPicks.set(batchId, quickPick);
    quickPick.show();
  }

  public static handleBatchClaimed(batchId: string) {
    Handler.claimedBatches.add(batchId);
    const quickPick = Handler.activeQuickPicks.get(batchId);
    if (quickPick) {
      quickPick.hide();
    }
  }

  private static async processProblem(companionProblems: CompanionProblem[]) {
    const srcPaths = await UserScriptManager.resolvePath(
      companionProblems,
      workspace.workspaceFolders?.map((f) => ({
        index: f.index,
        name: f.name,
        path: f.uri.fsPath,
      })) || [],
    );
    if (!srcPaths) {
      return;
    }
    Handler.logger.debug('Created problem source path', srcPaths);

    const createdDocuments: Uri[] = [];
    for (let i = 0; i < companionProblems.length; i++) {
      const companionProblem = companionProblems[i];
      const srcPath = srcPaths[i];
      if (!srcPath) {
        continue;
      }

      const problem = new CphProblem({
        name: companionProblem.name,
        url: companionProblem.url,
        tests: companionProblem.tests.map((test, id) => ({
          ...test,
          id,
        })),
        interactive: companionProblem.interactive,
        memoryLimit: companionProblem.memoryLimit,
        timeLimit: companionProblem.timeLimit,
        srcPath,
        group: companionProblem.group,
        local: true,
      }).toProblem();

      await mkdirIfNotExists(dirname(problem.src.path));
      if (existsSync(problem.src.path)) {
        Handler.logger.debug('Source file already exists', srcPath);
      } else {
        Handler.logger.debug('Creating new source file', srcPath);
        await Handler.createSourceFile(problem);
      }

      await problem.save();
      createdDocuments.push(Uri.file(srcPath));
    }

    if (createdDocuments.length > 0) {
      await commands.executeCommand(
        'vscode.open',
        createdDocuments[0],
        Settings.companion.showPanel,
      );

      if (createdDocuments.length > 1) {
        Io.info(
          l10n.t('Created {count} problems', {
            count: createdDocuments.length,
          }),
        );
      }
    }

    await ProblemsManager.dataRefresh();
  }

  private static async createSourceFile(problem: Problem): Promise<void> {
    Handler.logger.trace('createSourceFile', {
      problem,
    });
    try {
      await writeFile(problem.src.path, '');
      if (Settings.problem.templateFile) {
        Handler.logger.debug('Using template file', {
          templateFile: Settings.problem.templateFile,
        });
        try {
          await writeFile(problem.src.path, await renderTemplate(problem));
          Handler.logger.debug('Template applied successfully', {
            srcPath: problem.src.path,
          });
        } catch (e) {
          Handler.logger.warn('Template file error', e);
          Io.warn(
            l10n.t(
              'Failed to use template file: {msg}, creating empty file instead',
              { msg: (e as Error).message },
            ),
          );
        }
      } else {
        Handler.logger.debug(
          'No template file configured, creating empty file',
        );
      }
    } catch (e) {
      Handler.logger.error('Failed to create source file', e);
      throw new Error(`Failed to create source file: ${(e as Error).message}`);
    }
  }
}

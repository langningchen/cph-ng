// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import LlmDataInspector from '@/ai/llmDataInspector';
import LlmTcRunner from '@/ai/llmTcRunner';
import LlmTestCaseEditor from '@/ai/llmTestCaseEditor';
import LlmTestCaseLister from '@/ai/llmTestCaseLister';
import Cache from '@/helpers/cache';
import FolderChooser from '@/helpers/folderChooser';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import Companion from '@/modules/companion';
import { CphProblem } from '@/modules/problems/cphProblem';
import ProblemsManager from '@/modules/problems/manager';
import ProblemFs from '@/modules/problems/problemFs';
import {
  extensionPath,
  getActivePath,
  problemFs,
  setActivePath,
  setExtensionUri,
  sidebarProvider,
  telemetry,
} from '@/utils/global';
import { version } from '@/utils/packageInfo';
import { readFile, rm } from 'fs/promises';
import { release } from 'os';
import { join } from 'path';
import { EventEmitter } from 'stream';
import {
  commands,
  env,
  ExtensionContext,
  extensions,
  l10n,
  lm,
  MessageItem,
  window,
  workspace,
} from 'vscode';
import SidebarProvider from './sidebar';

interface ContextEvent {
  hasProblem: boolean;
  canImport: boolean;
  isRunning: boolean;
}

export default class ExtensionManager {
  private static logger: Logger = new Logger('extension');
  private static compatibleTimer: NodeJS.Timeout;
  public static event: EventEmitter<{
    context: ContextEvent[];
  }> = new EventEmitter();

  public static async activate(context: ExtensionContext) {
    ExtensionManager.logger.info('Activating CPH-NG extension');
    try {
      setExtensionUri(context.extensionUri);
      context.subscriptions.push(telemetry);
      await telemetry.init();
      const activateEnd = telemetry.start('activate');

      ExtensionManager.event.on('context', (context) => {
        for (const [key, value] of Object.entries(context)) {
          commands.executeCommand('setContext', `cph-ng.${key}`, value);
        }
      });

      if (Settings.cache.cleanOnStartup) {
        ExtensionManager.logger.info('Cleaning cache on startup');
        await rm(Settings.cache.directory, {
          force: true,
          recursive: true,
        });
      }

      await Cache.ensureDir();
      await Cache.startMonitor();
      Companion.init();

      context.subscriptions.push(
        window.registerWebviewViewProvider(
          SidebarProvider.viewType,
          sidebarProvider,
          {
            webviewOptions: {
              retainContextWhenHidden: Settings.sidebar.retainWhenHidden,
            },
          },
        ),
      );
      context.subscriptions.push(
        workspace.registerFileSystemProvider(ProblemFs.scheme, problemFs, {
          isCaseSensitive: true,
        }),
      );
      context.subscriptions.push(
        lm.registerTool('run_test_cases', new LlmTcRunner()),
      );
      context.subscriptions.push(
        lm.registerTool('inspect_problem_data', new LlmDataInspector()),
      );
      context.subscriptions.push(
        lm.registerTool('list_test_cases', new LlmTestCaseLister()),
      );
      context.subscriptions.push(
        lm.registerTool('upsert_test_case', new LlmTestCaseEditor()),
      );
      context.subscriptions.push(
        window.onDidChangeActiveTextEditor(async (editor) => {
          if (!editor) {
            return;
          }
          setActivePath(editor);
          sidebarProvider.event.emit('activePath', {
            activePath: getActivePath(),
          });
          await ProblemsManager.dataRefresh();
        }),
      );

      let lastAlertTime = 0;
      ExtensionManager.compatibleTimer = setInterval(async () => {
        const currentTime = Date.now();
        if (
          extensions.getExtension(
            'divyanshuagrawal.competitive-programming-helper',
          )?.isActive &&
          currentTime - lastAlertTime > 5 * 1000
        ) {
          lastAlertTime = currentTime;
          const result = (await Io.warn(
            l10n.t(
              "CPH-NG cannot run with CPH, but it can load CPH problem file. Please disable CPH to use CPH-NG. You can select the 'Ignore' option to ignore this warning in this session.",
            ),
            { modal: true },
            { title: l10n.t('OK') },
            { title: l10n.t('Ignore') },
          )) satisfies MessageItem | undefined;
          if (result?.title === l10n.t('Ignore')) {
            clearInterval(ExtensionManager.compatibleTimer);
          }
        }
      }, 1000 * 60);
      context.subscriptions.push({
        dispose: () => clearInterval(ExtensionManager.compatibleTimer),
      });

      context.subscriptions.push(
        commands.registerCommand('cph-ng.versionInfo', async () => {
          const generated = await readFile(
            join(extensionPath, 'dist', 'generated.json'),
            'utf8',
          ).then((data) => JSON.parse(data));
          const msg = `Version: ${version}
Commit: ${generated.commitHash}
Date: ${generated.buildTime}
Build By: ${generated.buildBy}
Build Type: ${generated.buildType}
OS: ${release()}`;
          const result = (await Io.info(
            'CPH-NG',
            { modal: true, detail: msg },
            { title: l10n.t('Copy') },
          )) satisfies MessageItem | undefined;
          if (result?.title === l10n.t('Copy')) {
            await env.clipboard.writeText(msg);
          }
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.importFromCph', async () => {
          const uri = await FolderChooser.chooseFolder(
            l10n.t('Please select the .cph folder contains the problem files'),
          );
          if (!uri) {
            return;
          }
          const problems = (await CphProblem.fromFolder(uri.fsPath)).map((p) =>
            p.toProblem(),
          );
          if (problems.length === 0) {
            Io.info(l10n.t('No CPH problem files found in the folder.'));
            return;
          }
          const chosenIdx = await window.showQuickPick(
            problems.map((p, idx) => ({
              label: p.name,
              description: [
                l10n.t('Number of test cases: {cnt}', {
                  cnt: p.tcOrder.length,
                }),
                p.checker ? l10n.t('Special Judge') : '',
                p.interactor ? l10n.t('Interactive') : '',
                p.bfCompare ? l10n.t('Brute Force Comparison') : '',
              ]
                .join(' ')
                .trim(),
              detail: p.url,
              picked: true,
              value: idx,
            })),
            {
              canPickMany: true,
              title: l10n.t('Select problems to import'),
            },
          );
          if (!chosenIdx || chosenIdx.length === 0) {
            return;
          }
          await Promise.all(chosenIdx.map((idx) => problems[idx.value].save()));
          await ProblemsManager.dataRefresh();
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.createProblem', async () => {
          sidebarProvider.focus();
          await ProblemsManager.createProblem({
            type: 'createProblem',
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.importProblem', async () => {
          sidebarProvider.focus();
          await ProblemsManager.importProblem({
            type: 'importProblem',
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.runTestCases', async () => {
          sidebarProvider.focus();
          await ProblemsManager.runTcs({
            type: 'runTcs',
            compile: null,
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.stopTestCases', async () => {
          sidebarProvider.focus();
          await ProblemsManager.stopTcs({
            type: 'stopTcs',
            onlyOne: false,
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.addTestCase', async () => {
          await ProblemsManager.addTc({
            type: 'addTc',
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.loadTestCases', async () => {
          await ProblemsManager.loadTcs({
            type: 'loadTcs',
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.deleteProblem', async () => {
          await ProblemsManager.delProblem({
            type: 'delProblem',
            activePath: getActivePath(),
          });
        }),
      );
      context.subscriptions.push(
        commands.registerCommand('cph-ng.submitToCodeforces', async () => {
          await ProblemsManager.submitToCodeforces({
            type: 'submitToCodeforces',
            activePath: getActivePath(),
          });
        }),
      );

      window.activeTextEditor && setActivePath(window.activeTextEditor);
      await ProblemsManager.dataRefresh();
      ExtensionManager.logger.info('CPH-NG extension activated successfully');
      activateEnd();
    } catch (e) {
      ExtensionManager.logger.error('Failed to activate extension', e);
      Io.error(
        l10n.t('Failed to activate CPH-NG extension: {msg}', {
          msg: (e as Error).message,
        }),
      );
      telemetry.error('activationError', {
        error: (e as Error).message,
      });
    }
  }

  public static async deactivate() {
    ExtensionManager.logger.info('Deactivating CPH-NG extension');
    Companion.stopServer();
    await ProblemsManager.closeAll();
    ExtensionManager.logger.info('CPH-NG extension deactivated');
  }
}

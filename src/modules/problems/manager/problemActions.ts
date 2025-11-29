import Langs from '@/core/langs/langs';
import Io from '@/helpers/io';
import ProcessExecutor from '@/helpers/processExecutor';
import Settings from '@/helpers/settings';
import Companion from '@/modules/companion';
import { Problem } from '@/types';
import { extensionPath } from '@/utils/global';
import { KnownResult } from '@/utils/result';
import * as msgs from '@w/msgs';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { commands, debug, l10n, Uri, window } from 'vscode';
import { CphProblem } from '../cphProblem';
import ProblemFs from '../problemFs';
import Store from './store';

export class ProblemActions {
  public static async createProblem(msg: msgs.CreateProblemMsg): Promise<void> {
    const src = msg.activePath;
    if (!src) {
      Io.warn(
        l10n.t(
          'No active editor found. Please open a file to create a problem.',
        ),
      );
      return;
    }
    const binPath = await Problem.getBinBySrc(src);
    if (binPath && existsSync(binPath)) {
      Io.warn(l10n.t('Problem already exists for this file.'));
      return;
    }
    const problem = new Problem(basename(src, extname(src)), src);
    await problem.save();
    await Store.dataRefresh();
  }
  public static async importProblem(msg: msgs.ImportProblemMsg): Promise<void> {
    const src = msg.activePath;
    if (!src) {
      Io.warn(
        l10n.t(
          'No active editor found. Please open a file to create a problem.',
        ),
      );
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
    await Store.dataRefresh();
  }

  public static async editProblemDetails(msg: msgs.EditProblemDetailsMsg) {
    const fullProblem = await Store.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    fullProblem.problem.name = msg.title;
    fullProblem.problem.url = msg.url;
    fullProblem.problem.timeLimit = msg.timeLimit;
    fullProblem.problem.memoryLimit = msg.memoryLimit;
    fullProblem.problem.compilationSettings = msg.compilationSettings;
    await Store.dataRefresh();
  }
  public static async delProblem(msg: msgs.DelProblemMsg) {
    const fullProblem = await Store.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    await fullProblem.problem.del();
    Store.removeProblem(fullProblem);
    await Store.dataRefresh();
  }

  public static async chooseSrcFile(msg: msgs.ChooseSrcFileMsg): Promise<void> {
    const fullProblem = await Store.getFullProblem(msg.activePath);
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
    await Store.dataRefresh();
  }
  public static async removeSrcFile(msg: msgs.RemoveSrcFileMsg): Promise<void> {
    const fullProblem = await Store.getFullProblem(msg.activePath);
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
    await Store.dataRefresh();
  }
  public static async submitToCodeforces(
    msg: msgs.SubmitToCodeforcesMsg,
  ): Promise<void> {
    const fullProblem = await Store.getFullProblem(msg.activePath);
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
    const fullProblem = await Store.getFullProblem(msg.activePath);
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
  public static async debugTc(msg: msgs.DebugTcMsg): Promise<void> {
    try {
      const fullProblem = await Store.getFullProblem(msg.activePath);
      if (!fullProblem) {
        return;
      }
      const srcLang = Langs.getLang(fullProblem.problem.src.path);
      if (!srcLang) {
        return;
      }

      const result = await srcLang.compile(
        fullProblem.problem.src,
        new AbortController(),
        null,
        {
          canUseWrapper: false,
          compilationSettings: fullProblem.problem.compilationSettings,
          debug: true,
        },
      );
      if (result instanceof KnownResult) {
        Io.error(
          l10n.t('Failed to compile the program: {msg}', {
            msg: result.msg,
          }),
        );
        return;
      }
      fullProblem.problem.src.hash = result.data!.hash;

      const outputPath = result.data?.outputPath;
      if (!outputPath) {
        Io.error(l10n.t('Compile data is empty.'));
        return;
      }

      const process = ProcessExecutor.launch({
        cmd: [outputPath],
        stdin: fullProblem.problem.tcs[msg.id].stdin,
        debug: true,
      });

      try {
        if (srcLang.name === 'C' || srcLang.name === 'C++') {
          await debug.startDebugging(undefined, {
            type: 'cppdbg',
            name: `CPH-NG Debug`,
            request: 'attach',
            processId: process.child.pid,
            program: outputPath,
            cwd: dirname(fullProblem.problem.src.path),
            setupCommands: [
              {
                description: 'Set breakpoint at main',
                text: '-break-insert -f main',
                ignoreFailures: false,
              },
            ],
          });
        } else {
          Io.error(l10n.t('Debugging is not supported for this language yet.'));
          return;
        }
      } catch (err) {
        Io.error(
          l10n.t('Failed to start debugger: {msg}', {
            msg: (err as Error).message,
          }),
        );
      }
    } catch (err) {
      Io.error(
        l10n.t('Failed to debug test case: {msg}', {
          msg: (err as Error).message,
        }),
      );
    }
  }
}

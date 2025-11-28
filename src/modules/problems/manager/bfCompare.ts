import { Compiler } from '@/core/compiler';
import Langs from '@/core/langs/langs';
import { Executor, Runner } from '@/core/runner';
import Cache from '@/helpers/cache';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { Tc, TcIo, TcResult, TcVerdicts, TcWithResult } from '@/types';
import { waitUntil } from '@/utils/global';
import { KnownResult } from '@/utils/result';
import * as msgs from '@w/msgs';
import { l10n } from 'vscode';
import Store from './store';

export class BfCompare {
  private static logger = new Logger('bfCompare');

  public static async startBfCompare(
    msg: msgs.StartBfCompareMsg,
  ): Promise<void> {
    const fullProblem = await Store.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    const bfCompare = fullProblem.problem.bfCompare;
    if (!bfCompare || !bfCompare.generator || !bfCompare.bruteForce) {
      Io.warn(
        l10n.t('Please choose both generator and brute force files first.'),
      );
      return;
    }
    if (bfCompare.running) {
      Io.warn(l10n.t('Brute Force comparison is already running.'));
      return;
    }
    fullProblem.ac && fullProblem.ac.abort();
    fullProblem.ac = new AbortController();
    const srcLang = Langs.getLang(fullProblem.problem.src.path);
    const generatorLang = Langs.getLang(bfCompare.generator.path);
    const bruteForceLang = Langs.getLang(bfCompare.bruteForce.path);
    if (!srcLang || !generatorLang || !bruteForceLang) {
      Io.warn(
        l10n.t(
          'Failed to detect language for source, generator, or brute force.',
        ),
      );
      return;
    }

    let cnt = 0;
    try {
      bfCompare.running = true;
      bfCompare.msg = l10n.t('Compiling...');
      await Store.dataRefresh();
      const compileResult = await Compiler.compileAll(
        fullProblem.problem,
        msg.compile,
        fullProblem.ac,
      );
      if (compileResult instanceof KnownResult) {
        bfCompare.msg =
          compileResult.msg || l10n.t('Solution compilation failed');
        return;
      }
      if (!compileResult.data.bfCompare) {
        bfCompare.msg = l10n.t(
          'Both generator and brute force source files must be provided for brute force comparison.',
        );
        return;
      }

      while (true) {
        cnt++;
        if (fullProblem.ac.signal.aborted) {
          bfCompare.msg = l10n.t('Brute Force comparison stopped by user.');
          break;
        }

        bfCompare.msg = l10n.t('#{cnt} Running generator...', {
          cnt,
        });
        await Store.dataRefresh();
        const generatorRunResult = await Executor.doRun({
          cmd: await generatorLang.getRunCommand(
            compileResult.data.bfCompare!.generator.outputPath,
          ),
          timeLimit: Settings.bfCompare.generatorTimeLimit,
          stdin: new TcIo(false, ''),
          ac: fullProblem.ac,
          enableRunner: false,
        });
        if (generatorRunResult instanceof KnownResult) {
          generatorRunResult.data &&
            Cache.dispose([
              generatorRunResult.data.stdoutPath,
              generatorRunResult.data.stderrPath,
            ]);
          generatorRunResult.verdict !== TcVerdicts.RJ &&
            (bfCompare.msg = l10n.t('Generator run failed: {msg}', {
              msg: generatorRunResult.msg,
            }));
          break;
        }
        Cache.dispose(generatorRunResult.data.stderrPath);
        const stdin = new TcIo(true, generatorRunResult.data.stdoutPath);

        bfCompare.msg = l10n.t('#{cnt} Running brute force...', {
          cnt,
        });
        await Store.dataRefresh();
        const bruteForceRunResult = await Executor.doRun({
          cmd: await bruteForceLang.getRunCommand(
            compileResult.data.bfCompare!.bruteForce.outputPath,
          ),
          timeLimit: Settings.bfCompare.bruteForceTimeLimit,
          stdin,
          ac: fullProblem.ac,
          enableRunner: false,
        });
        if (bruteForceRunResult instanceof KnownResult) {
          stdin.dispose();
          bruteForceRunResult.data &&
            Cache.dispose([
              bruteForceRunResult.data.stdoutPath,
              bruteForceRunResult.data.stderrPath,
            ]);
          bruteForceRunResult.verdict !== TcVerdicts.RJ &&
            (bfCompare.msg = l10n.t('Brute force run failed: {msg}', {
              msg: bruteForceRunResult.msg,
            }));
          break;
        }
        Cache.dispose(bruteForceRunResult.data.stderrPath);

        bfCompare.msg = l10n.t('#{cnt} Running solution...', {
          cnt,
        });
        await Store.dataRefresh();
        const tempTc = Tc.fromI({
          stdin,
          answer: new TcIo(true, bruteForceRunResult.data.stdoutPath),
          isExpand: true,
          isDisabled: false,
          result: new TcResult(TcVerdicts.CP),
        }) as TcWithResult;
        await Runner.run(
          fullProblem.problem,
          tempTc,
          srcLang,
          fullProblem.ac,
          compileResult.data!,
        );
        if (tempTc.result.verdict !== TcVerdicts.AC) {
          if (tempTc.result.verdict !== TcVerdicts.RJ) {
            await tempTc.stdin.inlineSmall();
            await tempTc.answer.inlineSmall();
            fullProblem.problem.addTc(
              new Tc(tempTc.stdin, tempTc.answer, true),
            );
            bfCompare.msg = l10n.t('Found a difference in #{cnt} run.', {
              cnt,
            });
          }
          break;
        }
        tempTc.stdin.dispose();
        tempTc.answer.dispose();
        tempTc.result.dispose();
      }
    } finally {
      bfCompare.running = false;
      if (fullProblem.ac?.signal.aborted) {
        bfCompare.msg = l10n.t(
          'Brute Force comparison stopped by user, {cnt} runs completed.',
          { cnt },
        );
      }
      fullProblem.ac = null;
      await Store.dataRefresh();
    }
  }

  public static async stopBfCompare(msg: msgs.StopBfCompareMsg): Promise<void> {
    const fullProblem = await Store.getFullProblem(msg.activePath);
    if (!fullProblem) {
      return;
    }
    if (
      !fullProblem.problem.bfCompare ||
      !fullProblem.problem.bfCompare.running
    ) {
      Io.warn(l10n.t('Brute Force comparison is not running.'));
      return;
    }
    fullProblem.ac && fullProblem.ac.abort();
    await waitUntil(() => !fullProblem.ac);
    this.logger.info('Brute Force comparison stopped');
    await Store.dataRefresh();
  }
}

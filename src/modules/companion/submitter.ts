import { readFile } from 'fs/promises';
import { l10n, ProgressLocation, window } from 'vscode';
import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { Problem } from '@/types';
import { telemetry } from '@/utils/global';
import { CompanionClient } from './client';
import { CphSubmitEmpty, CphSubmitResponse } from './types';

class CancellationError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancellationError';
  }
}

export class Submitter {
  private static logger: Logger = new Logger('companionSubmitter');

  public static async submit(problem?: Problem): Promise<void> {
    Submitter.logger.trace('submit', { problem });
    if (!problem) {
      return;
    }
    // Map of language display names to submission language IDs used for QuickPick and persistence
    const languageList = {
      'GNU G++17 7.3.0': 54,
      'GNU G++20 13.2 (64 bit, winlibs)': 89,
      'GNU G++23 14.2 (64 bit, msys2)': 91,
    } as const;

    let submitLanguageId = Settings.companion.submitLanguage;
    if (!(Object.values(languageList) as number[]).includes(submitLanguageId)) {
      const choice = await window.showQuickPick(Object.keys(languageList), {
        placeHolder: l10n.t('Choose submission language'),
      });
      if (!choice) {
        Io.info(l10n.t('Submission cancelled.'));
        return;
      }
      submitLanguageId = languageList[choice as keyof typeof languageList];
      Settings.companion.submitLanguage = submitLanguageId;
    }

    const sourceCode = await readFile(problem.src.path, 'utf-8');
    Submitter.logger.debug('Read source code for submission', {
      srcPath: problem.src.path,
      sourceCode,
    });
    if (sourceCode.trim() === '') {
      Io.warn(l10n.t('Source code is empty. Submission cancelled.'));
      return;
    }
    Submitter.logger.info(
      `Submitting problem ${problem.name} using language ${submitLanguageId} and file ${problem.src.path}`,
    );
    const requestData: Exclude<CphSubmitResponse, CphSubmitEmpty> = {
      empty: false,
      problemName: problem.name,
      url: problem.url || '',
      sourceCode:
        sourceCode +
        (Settings.companion.addTimestamp
          ? `\n// Submitted via cph-ng at ${new Date().toISOString()}`
          : ''),
      languageId: submitLanguageId,
    };
    Submitter.logger.debug('Submission data', requestData);

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t('Waiting response from cph-submit...'),
        cancellable: true,
      },
      async (progress, token) => {
        try {
          if (token.isCancellationRequested) {
            Io.info(l10n.t('Submission cancelled by user.'));
            return;
          }

          const submissionId = CompanionClient.sendSubmit(requestData);

          if (!submissionId) {
            return;
          }

          const abortController = new AbortController();
          let disposable: { dispose(): any } | undefined;
          try {
            await Promise.race([
              CompanionClient.waitForSubmissionConsumed(
                submissionId,
                abortController.signal,
              ),
              new Promise((_, reject) => {
                disposable = token.onCancellationRequested(() => {
                  CompanionClient.sendCancelSubmit(submissionId);
                  abortController.abort();
                  reject(new CancellationError());
                });
              }),
            ]);
          } finally {
            disposable?.dispose();
            // Ensure we abort the wait if the race finished by other means (though here it's mostly for the cancellation path)
            // If waitForSubmissionConsumed finished first, aborting does nothing.
            // If cancellation happened, we already aborted above, but it's safe to call again.
            abortController.abort();
          }

          Io.info(l10n.t('Submission payload consumed by companion'));
        } catch (err: any) {
          if (err instanceof CancellationError) {
            Io.info(l10n.t('Submission cancelled by user.'));
            return;
          }
          Submitter.logger.error('Submission failed', { error: err });
          telemetry.error('companionSubmissionFailed', err);
          window.showErrorMessage(
            l10n.t('Submission failed: {msg}', {
              msg: Submitter.getErrorMessage(err),
            }),
          );
        }
      },
    );
  }

  private static getErrorMessage(err: unknown): string {
    return (err as Error).message;
  }
}

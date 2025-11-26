import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { Problem } from '@/types';
import { readFile } from 'fs/promises';
import { l10n, ProgressLocation, window } from 'vscode';
import { CphSubmitEmpty, CphSubmitResponse } from './types';

export class Submitter {
    private static logger: Logger = new Logger('companion-submitter');
    private static isSubmitting = false;
    private static pendingSubmitData?: Exclude<
        CphSubmitResponse,
        { empty: true }
    >;
    private static pendingSubmitResolve?: () => void;

    public static async submit(problem?: Problem): Promise<void> {
        Submitter.logger.trace('submit', { problem });
        if (!problem) {
            return;
        }
        const languageList = {
            'GNU G++17 7.3.0': 54,
            'GNU G++20 13.2 (64 bit, winlibs)': 89,
            'GNU G++23 14.2 (64 bit, msys2)': 91,
        };
        if (Submitter.isSubmitting) {
            Io.warn(l10n.t('A submission is already in progress.'));
            return Promise.reject(new Error('Submission already in progress'));
        }

        let submitLanguageId = Settings.companion.submitLanguage;
        if (!Object.values(languageList).includes(submitLanguageId)) {
            const choice = await window.showQuickPick(
                Object.keys(languageList),
                { placeHolder: l10n.t('Choose submission language') },
            );
            if (!choice) {
                Io.info(l10n.t('Submission cancelled.'));
                return;
            }
            submitLanguageId =
                languageList[choice as keyof typeof languageList];
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

        Submitter.isSubmitting = true;
        return await window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: l10n.t('Waiting response from cph-submit...'),
                cancellable: true,
            },
            async (_, token) =>
                new Promise<void>((resolve, _) => {
                    Submitter.pendingSubmitData = requestData;

                    const cleanup = () => {
                        Submitter.isSubmitting = false;
                        Submitter.pendingSubmitData = undefined;
                        Submitter.pendingSubmitResolve = undefined;
                    };
                    Submitter.pendingSubmitResolve = () => {
                        Submitter.logger.info(
                            'Submission payload consumed by companion',
                        );
                        cleanup();
                        resolve();
                    };

                    token.onCancellationRequested(() => {
                        Io.warn(l10n.t('Submission cancelled.'));
                        cleanup();
                        resolve();
                    });
                }),
        );
    }

    public static async processSubmit(): Promise<CphSubmitResponse> {
        Submitter.logger.trace('processSubmit');
        const data = Submitter.pendingSubmitData;
        if (data) {
            Submitter.logger.debug('Pending submission data found', data);
            Submitter.pendingSubmitData = undefined;
            return data;
        }
        Submitter.logger.trace('No pending submission data');
        return { empty: true };
    }

    public static resolvePendingSubmit() {
        Submitter.pendingSubmitResolve?.();
    }
}

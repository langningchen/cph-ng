// Copyright (C) 2026 Langning Chen
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

import type { CompanionProblem, CphSubmitData } from '@r/types';
import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ICompanion } from '@/application/ports/services/ICompanion';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { ImportCompanionProblems } from '@/application/useCases/companion/ImportCompanionProblems';
import { TOKENS } from '@/composition/tokens';
import type { Problem } from '@/domain/entities/problem';
import type { BatchId, SubmissionId } from '@/domain/types';
import { CompanionCommunicationService } from '@/infrastructure/services/companion/companionCommunicationService';
import { CompanionStatusbarService } from '@/infrastructure/services/companion/companionStatusbarService';

export type BatchList = Map<BatchId, CompanionProblem[]>;

@injectable()
export class Companion implements ICompanion {
  private abortControllers: Map<BatchId | SubmissionId, AbortController> = new Map();
  private readingProgress: Map<BatchId, (count: number, size: number) => void> = new Map();
  private batchesToClaim: BatchList = new Map();

  public constructor(
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(CompanionCommunicationService) private readonly ws: CompanionCommunicationService,
    @inject(CompanionStatusbarService) private readonly statusbar: CompanionStatusbarService,
    @inject(ImportCompanionProblems) private readonly importUseCase: ImportCompanionProblems,
  ) {
    this.logger = this.logger.withScope('companion');
    this.ws.signals.on('statusChanged', this.updateStatusbar);
    this.ws.signals.on('readingBatch', this.readingBatch);
    this.ws.signals.on('batchAvailable', this.batchAvailable);
    this.ws.signals.on('batchClaimed', this.batchClaimed);
    this.ws.signals.on('submissionConsumed', this.submissionConsumed);
    this.statusbar.signals.on('click', this.handleStatusBarClick);
  }

  private removeBatch(batchId: BatchId) {
    this.abortControllers.delete(batchId);
    this.batchesToClaim.delete(batchId);
  }
  private updateStatusbar = () => {
    this.statusbar.update(this.ws.getStatus(), this.batchesToClaim);
  };

  private handleStatusBarClick = async () => {
    this.logger.debug('Status bar item clicked');
    if (this.ws.getStatus() !== 'ONLINE') return this.ws.spawnRouter();
    if (this.batchesToClaim.size === 0) this.logger.info('No batches to claim');
    else if (this.batchesToClaim.size === 1) {
      const batchId = Array.from(this.batchesToClaim.keys())[0];
      const problems = this.batchesToClaim.get(batchId);
      if (problems) await this.claimAndImport(batchId, problems);
    } else {
      const batchId = await this.ui.quickPick<BatchId>(
        Array.from(this.batchesToClaim.entries()).map(([batchId, problems]) => ({
          label: this.translator.t('{count} problem(s) available', { count: problems.length }),
          description:
            `${problems.reduce((prev, problem) => Math.max(prev, problem.timeLimit), 0)}ms, ` +
            `${problems.reduce((prev, problem) => Math.max(prev, problem.memoryLimit), 0)}MB`,
          detail: problems.map((problem) => problem.name).join(', '),
          value: batchId,
        })),
        { title: this.translator.t('Select a batch to claim') },
      );
      if (batchId) {
        const problems = this.batchesToClaim.get(batchId);
        if (problems) await this.claimAndImport(batchId, problems);
      }
    }
  };

  private readingBatch = (batchId: BatchId, count: number, size: number) => {
    if (!this.readingProgress.get(batchId)) {
      const progress = this.ui.progress(
        this.translator.t('Reading problems from companion...'),
        () => this.ws.cancelBatch(batchId),
      );
      this.readingProgress.set(batchId, (count, size) => {
        progress.report({ increment: (1 / size) * 100 });
        if (count >= size) {
          progress.done();
          this.readingProgress.delete(batchId);
        }
      });
    }
    this.readingProgress.get(batchId)?.(count, size);
  };
  private batchAvailable = async (
    batchId: BatchId,
    problems: CompanionProblem[],
    autoImport: boolean,
  ) => {
    const controller = new AbortController();
    this.abortControllers.set(batchId, controller);
    if (autoImport) {
      this.logger.info('Auto-importing batch', { batchId });
      await this.claimAndImport(batchId, problems);
      this.abortControllers.delete(batchId);
    } else {
      this.batchesToClaim.set(batchId, problems);
      controller.signal.addEventListener('abort', () => {
        this.removeBatch(batchId);
      });
      this.updateStatusbar();
    }
  };

  private async claimAndImport(batchId: BatchId, problems: CompanionProblem[]) {
    try {
      this.ws.claimBatch(batchId);
      await this.importUseCase.exec(problems);
    } catch (e) {
      this.logger.error('Failed to import companion problems', e);
      this.ui.alert(
        'error',
        this.translator.t('Failed to import problems: {msg}', { msg: (e as Error).message }),
      );
    }
  }

  private batchClaimed = (batchId: BatchId) => {
    this.logger.info('Batch claimed', { batchId });
    const controller = this.abortControllers.get(batchId);
    if (controller) controller.abort();
    this.updateStatusbar();
  };
  private submissionConsumed = (submissionId: SubmissionId) => {
    this.logger.info('Submission consumed', { submissionId });
    const controller = this.abortControllers.get(submissionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(submissionId);
    }
  };

  public connect() {
    this.ws.connect();
  }
  public disconnect() {
    this.ws.disconnect();
  }
  public async submit(problem: Problem) {
    if (!problem.url) throw new Error(this.translator.t('Problem URL is undefined'));
    this.logger.info('Submitting problem', { problem });

    const data = {
      empty: false,
      problemName: problem.name,
      url: problem.url,
      sourceCode: await this.fs.readFile(problem.src.path),
      languageId: this.settings.companion.submitLanguage,
    } satisfies CphSubmitData;

    return new Promise<void>((resolve) => {
      const submissionId = this.ws.submit(data);
      const controller = new AbortController();
      this.abortControllers.set(submissionId, controller);
      const progress = this.ui.progress(
        this.translator.t('Submitting {name}...', { name: problem.name }),
        () => {
          this.ws.cancelSubmit(submissionId);
          resolve();
        },
      );
      controller.signal.addEventListener('abort', () => {
        progress.done();
        this.abortControllers.delete(submissionId);
        resolve();
      });
    });
  }
}

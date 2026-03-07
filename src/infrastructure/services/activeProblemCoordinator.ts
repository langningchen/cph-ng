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

import { inject, injectable } from 'tsyringe';
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { Problem, ProblemMetaPayload } from '@/domain/entities/problem';
import type { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import type { TestcaseId, WithRevision } from '@/domain/types';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

@injectable()
export class ActiveProblemCoordinator implements IActiveProblemCoordinator {
  private active: BackgroundProblem | null = null;
  private switchingPromise: Promise<void> | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private readonly autoSaveDelayMs = 2000; // 2 seconds debounce

  public constructor(
    @inject(TOKENS.activePathService) private readonly activePathService: IActivePathService,
    @inject(TOKENS.cphMigrationService) private readonly cph: ICphMigrationService,
    @inject(TOKENS.extensionContext) private readonly context: IExtensionContext,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(WebviewProblemMapper) private readonly mapper: WebviewProblemMapper,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
  ) {
    this.logger = this.logger.withScope('activeProblemCoordinator');
    this.problemFs.signals.on('problemFileChanged', () => {
      this.dispatchFullData();
    });
  }

  public async dispatchFullData() {
    if (this.active) {
      this.logger.trace('Dispatching full data for active problem', { active: this.active });
      this.eventBus.fullProblem(this.active.problemId, this.mapper.toDto(this.active.problem));
      return;
    }
    const canImport = this.context.canImport;
    this.logger.trace('No active problem to dispatch', { canImport });
    this.eventBus.noProblem(canImport);
  }

  private scheduleAutoSave() {
    if (!this.active) return;

    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Schedule new auto-save
    this.autoSaveTimer = setTimeout(async () => {
      if (!this.active) return;

      this.logger.debug('Auto-saving active problem', { problemId: this.active.problemId });
      try {
        await this.problemService.save(this.active.problem);
        this.logger.trace('Auto-save completed', { problemId: this.active.problemId });
      } catch (e) {
        this.logger.error('Auto-save failed', e);
        // Don't throw - auto-save is best-effort
      } finally {
        // Clear the timer reference when finished so callers can reliably check
        // whether a pending timer exists.
        this.autoSaveTimer = null;
      }
    }, this.autoSaveDelayMs);
  }

  private onPatchMeta = async (payload: WithRevision<ProblemMetaPayload>) => {
    if (!this.active) return;
    const { revision, checker, interactor } = payload;
    this.eventBus.patchMeta(this.active.problemId, {
      revision,
      checker: checker ? this.mapper.fileWithHashToDto(checker) : checker,
      interactor: interactor ? this.mapper.fileWithHashToDto(interactor) : interactor,
    });
    this.problemFs.signals.emit('patchProblem', this.active.problem.src.path);
  };

  private onPatchStressTest = async (payload: WithRevision<Partial<StressTest>>) => {
    if (!this.active) return;
    const { revision, ...rest } = payload;
    this.eventBus.patchStressTest(this.active.problemId, {
      ...this.mapper.stressTestToDto(rest),
      revision,
    });
    this.problemFs.signals.emit('patchProblem', this.active.problem.src.path);
  };

  private onAddTestcase = async (testcaseId: TestcaseId, payload: Testcase, revision: number) => {
    if (!this.active) return;
    this.eventBus.addTestcase(this.active.problemId, testcaseId, {
      ...this.mapper.testcaseToDto(payload),
      revision,
    });
    this.problemFs.signals.emit('addTestcase', this.active.problem.src.path, testcaseId, payload);
    this.scheduleAutoSave();
  };

  private onDeleteTestcase = async (testcaseId: TestcaseId, revision: number) => {
    if (!this.active) return;
    this.eventBus.deleteTestcase(this.active.problemId, testcaseId, { revision });
    this.problemFs.signals.emit('deleteTestcase', this.active.problem.src.path, testcaseId);
    this.scheduleAutoSave();
  };

  private onPatchTestcase = async (
    testcaseId: TestcaseId,
    payload: Partial<Testcase>,
    revision: number,
  ) => {
    if (!this.active) return;
    this.eventBus.patchTestcase(this.active.problemId, testcaseId, {
      ...this.mapper.testcaseToDto(payload),
      revision,
    });
    this.problemFs.signals.emit('patchTestcase', this.active.problem.src.path, testcaseId, payload);
    this.scheduleAutoSave();
  };

  private onPatchTestcaseResult = async (
    testcaseId: TestcaseId,
    payload: Partial<TestcaseResult>,
    revision: number,
  ) => {
    if (!this.active) return;
    this.eventBus.patchTestcaseResult(this.active.problemId, testcaseId, {
      ...this.mapper.testcaseResultToDto(payload),
      revision,
    });
    this.problemFs.signals.emit('patchTestcase', this.active.problem.src.path, testcaseId, payload);
  };

  private attachListeners(problem: Problem) {
    problem.signals.on('patchMeta', this.onPatchMeta);
    problem.signals.on('patchStressTest', this.onPatchStressTest);
    problem.signals.on('addTestcase', this.onAddTestcase);
    problem.signals.on('deleteTestcase', this.onDeleteTestcase);
    problem.signals.on('patchTestcase', this.onPatchTestcase);
    problem.signals.on('patchTestcaseResult', this.onPatchTestcaseResult);
  }

  private detachListeners(problem: Problem) {
    problem.signals.off('patchMeta', this.onPatchMeta);
    problem.signals.off('patchStressTest', this.onPatchStressTest);
    problem.signals.off('addTestcase', this.onAddTestcase);
    problem.signals.off('deleteTestcase', this.onDeleteTestcase);
    problem.signals.off('patchTestcase', this.onPatchTestcase);
    problem.signals.off('patchTestcaseResult', this.onPatchTestcaseResult);
  }

  public async onActiveEditorChanged() {
    // Serialize calls to prevent race conditions during rapid file switching
    // Chain each call onto the previous promise so callers queue instead of
    // all awaiting the same promise and racing when it resolves.
    const previous = this.switchingPromise ?? Promise.resolve();

    let queuePromise: Promise<void>;
    queuePromise = previous
      .then(() => this._onActiveEditorChangedImpl())
      .finally(() => {
        // Only clear if this is still the latest queued operation
        if (this.switchingPromise === queuePromise) {
          this.switchingPromise = null;
        }
      });

    this.switchingPromise = queuePromise;
    await queuePromise;
  }

  private async _onActiveEditorChangedImpl() {
    // Clear any pending auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.active) {
      this.detachListeners(this.active.problem);
      this.logger.debug('Unload previous active problem', { problemId: this.active.problemId });
      try {
        await this.repo.persist(this.active.problemId);
        this.logger.trace('Persisted previous active problem on active change', {
          problemId: this.active.problemId,
        });
      } catch (e) {
        this.logger.error('Failed to persist previous active problem', e);
        // Continue even if persist fails - the problem is still in memory in the repo
      }
    }

    const filePath = this.activePathService.getActivePath();
    if (!filePath) {
      this.active = null;
      this.context.hasProblem = false;
      this.eventBus.noProblem(false);
      return;
    }
    const backgroundProblem = await this.repo.loadByPath(filePath);
    this.logger.trace('Active editor changed', { filePath, backgroundProblem });
    if (!backgroundProblem) {
      this.active = null;
      const canImport = await this.cph.canMigrate(filePath);
      this.context.hasProblem = false;
      this.context.canImport = canImport;
      this.eventBus.noProblem(canImport);
    } else {
      this.active = backgroundProblem;
      this.attachListeners(backgroundProblem.problem);
      this.eventBus.fullProblem(
        backgroundProblem.problemId,
        this.mapper.toDto(backgroundProblem.problem),
      );
      this.context.hasProblem = true;
      this.logger.debug('Set new active problem', { problemId: backgroundProblem.problemId });
    }
  }
}

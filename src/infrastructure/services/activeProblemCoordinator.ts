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
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { Problem, ProblemMetaPayload } from '@/domain/entities/problem';
import type { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import type { ProblemId, TestcaseId, WithRevision } from '@/domain/types';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

// TO-DO: ProblemFs Emit

@injectable()
export class ActiveProblemCoordinator implements IActiveProblemCoordinator {
  private active: BackgroundProblem | null = null;
  private lastAccessMap: Map<ProblemId, number> = new Map();
  private monitorInterval: NodeJS.Timeout;

  public constructor(
    @inject(TOKENS.cphMigrationService) private readonly cph: ICphMigrationService,
    @inject(TOKENS.extensionContext) private readonly context: IExtensionContext,
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(WebviewProblemMapper) private readonly mapper: WebviewProblemMapper,
  ) {
    this.logger = this.logger.withScope('activeProblemCoordinator');
    this.monitorInterval = setInterval(async () => {
      const now = Date.now();
      for (const [problemId, lastAccess] of this.lastAccessMap)
        if (
          now - lastAccess > 60 * 1000 &&
          problemId !== this.active?.problemId &&
          (await this.repo.persist(problemId))
        ) {
          this.logger.trace('Persisted inactive problem', { problemId });
          this.lastAccessMap.delete(problemId);
        }
    }, 1000);

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

  private onPatchMeta = async (payload: WithRevision<ProblemMetaPayload>) => {
    if (!this.active) return;
    const { revision, checker, interactor } = payload;
    this.eventBus.patchMeta(this.active.problemId, {
      revision,
      checker: checker ? this.mapper.fileWithHashToDto(checker) : checker,
      interactor: interactor ? this.mapper.fileWithHashToDto(interactor) : interactor,
    });
  };

  private onPatchStressTest = async (payload: WithRevision<Partial<StressTest>>) => {
    if (!this.active) return;
    const { revision, ...rest } = payload;
    this.eventBus.patchStressTest(this.active.problemId, {
      ...this.mapper.stressTestToDto(rest),
      revision,
    });
  };

  private onAddTestcase = async (testcaseId: TestcaseId, payload: Testcase, revision: number) => {
    if (!this.active) return;
    this.eventBus.addTestcase(this.active.problemId, testcaseId, {
      ...this.mapper.testcaseToDto(payload),
      revision,
    });
  };

  private onDeleteTestcase = async (testcaseId: TestcaseId, revision: number) => {
    if (!this.active) return;
    this.eventBus.deleteTestcase(this.active.problemId, testcaseId, { revision });
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

  public dispose() {
    clearInterval(this.monitorInterval);
  }

  public async onActiveEditorChanged(filePath: string | undefined) {
    if (!filePath) return;
    const backgroundProblem = await this.repo.loadByPath(filePath);
    this.logger.trace('Active editor changed', { filePath, backgroundProblem });
    if (!backgroundProblem) {
      if (this.lang.getLang(filePath)) {
        this.context.hasProblem = false;
        this.active = null;
        const canImport = await this.cph.canMigrate(filePath);
        this.context.canImport = canImport;
        this.eventBus.noProblem(canImport);
      }
      return;
    }
    this.context.hasProblem = true;
    const { problem, problemId } = backgroundProblem;
    if (problemId !== this.active?.problemId) {
      if (this.active) {
        this.detachListeners(this.active.problem);
        await this.repo.persist(this.active.problemId);
        this.logger.debug('Unload previous active problem', { problemId: this.active.problemId });
      }
      if (!problem) {
        this.logger.error('Active problem not found in repository after loading', {
          problemId,
        });
        return;
      }
      this.active = backgroundProblem;
      this.lastAccessMap.set(problemId, Date.now());
      this.eventBus.fullProblem(problemId, this.mapper.toDto(problem));
      this.attachListeners(problem);
      this.logger.debug('Loaded new active problem', { problemId });
    } else {
      this.logger.trace('Active problem remains unchanged', { problemId });
    }
  }
}

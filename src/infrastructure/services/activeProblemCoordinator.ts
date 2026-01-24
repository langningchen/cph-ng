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

import type { UUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { ProblemMetaPayload } from '@/domain/entities/problem';
import type { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

@injectable()
export class ActiveProblemCoordinator implements IActiveProblemCoordinator {
  private activeProblemId: UUID | null = null;
  private lastAccessMap: Map<UUID, number> = new Map();

  public constructor(
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(TOKENS.extensionContext) private readonly context: IExtensionContext,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.cphMigrationService) private readonly cph: ICphMigrationService,
    @inject(WebviewProblemMapper) private readonly mapper: WebviewProblemMapper,
  ) {
    setInterval(async () => {
      const now = Date.now();
      for (const [id, lastAccess] of this.lastAccessMap)
        if (
          now - lastAccess > 60 * 1000 &&
          id !== this.activeProblemId &&
          (await this.repo.persist(id))
        ) {
          this.logger.trace('Persisted inactive problem', { id });
          this.lastAccessMap.delete(id);
        }
    }, 1000);
  }

  public async dispatchFullData() {
    if (this.activeProblemId) {
      const bgProblem = await this.repo.get(this.activeProblemId);
      if (bgProblem) {
        this.logger.trace('Dispatching full data for active problem', { id: this.activeProblemId });
        this.eventBus.fullProblem(this.activeProblemId, this.mapper.toDto(bgProblem.problem));
        return;
      }
      this.logger.warn('Active problem not found in repository');
    }
    const canImport = this.context.canImport;
    this.logger.trace('No active problem to dispatch', { canImport });
    this.eventBus.noProblem(canImport);
  }
  public async onActiveEditorChanged(filePath: string | undefined) {
    if (!filePath) return;
    const problemId =
      (await this.repo.getIdByPath(filePath)) || (await this.repo.loadByPath(filePath));
    this.logger.trace('Active editor changed', { filePath, problemId });
    if (!problemId) {
      this.context.hasProblem = false;
      const canImport = await this.cph.canMigrate(filePath);
      this.context.canImport = canImport;
      this.eventBus.noProblem(canImport);
      return;
    }
    this.context.hasProblem = true;
    if (problemId !== this.activeProblemId) {
      const onPatchMeta = async ({ checker, interactor }: ProblemMetaPayload) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchMeta(this.activeProblemId, {
          checker: checker ? this.mapper.fileWithHashToDto(checker) : checker,
          interactor: interactor ? this.mapper.fileWithHashToDto(interactor) : interactor,
        });
      };
      const onPatchStressTest = async (payload: Partial<StressTest>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchStressTest(this.activeProblemId, this.mapper.stressTestToDto(payload));
      };
      const onAddTestcase = async (id: UUID, payload: Testcase) => {
        if (!this.activeProblemId) return;
        this.eventBus.addTestcase(this.activeProblemId, id, this.mapper.testcaseToDto(payload));
      };
      const onDeleteTestcase = async (id: UUID) => {
        if (!this.activeProblemId) return;
        this.eventBus.deleteTestcase(this.activeProblemId, id);
      };
      const onPatchTestcase = async (id: UUID, payload: Partial<Testcase>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchTestcase(this.activeProblemId, id, this.mapper.testcaseToDto(payload));
      };
      const onPatchTestcaseResult = async (id: UUID, payload: Partial<TestcaseResult>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchTestcaseResult(
          this.activeProblemId,
          id,
          this.mapper.testcaseResultToDto(payload),
        );
      };

      if (this.activeProblemId) {
        const bgProblem = await this.repo.get(this.activeProblemId);
        const problem = bgProblem?.problem;
        if (problem) {
          problem.signals.off('patchMeta', onPatchMeta);
          problem.signals.off('patchStressTest', onPatchStressTest);
          problem.signals.off('addTestcase', onAddTestcase);
          problem.signals.off('deleteTestcase', onDeleteTestcase);
          problem.signals.off('patchTestcase', onPatchTestcase);
          problem.signals.off('patchTestcaseResult', onPatchTestcaseResult);
          await this.repo.persist(this.activeProblemId);
        } else
          this.logger.warn('Previous active problem not found in repository', {
            problemId: this.activeProblemId,
          });
      }
      this.activeProblemId = problemId;
      this.lastAccessMap.set(problemId, Date.now());
      const bgProblem = await this.repo.get(problemId);
      if (!bgProblem) {
        this.logger.error('Active problem not found in repository after loading', { problemId });
        return;
      }
      this.eventBus.fullProblem(problemId, this.mapper.toDto(bgProblem.problem));
      bgProblem.problem.signals.on('patchMeta', onPatchMeta);
      bgProblem.problem.signals.on('patchStressTest', onPatchStressTest);
      bgProblem.problem.signals.on('addTestcase', onAddTestcase);
      bgProblem.problem.signals.on('deleteTestcase', onDeleteTestcase);
      bgProblem.problem.signals.on('patchTestcase', onPatchTestcase);
      bgProblem.problem.signals.on('patchTestcaseResult', onPatchTestcaseResult);
    }
  }
}

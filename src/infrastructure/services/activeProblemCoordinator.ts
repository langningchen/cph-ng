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
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { Problem, ProblemMetaPayload } from '@/domain/entities/problem';
import type { StressTest } from '@/domain/entities/stressTest';
import type { Testcase, TestcaseResult } from '@/domain/entities/testcase';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

interface ActiveData {
  problemId: UUID;
  problem: Problem;
}

@injectable()
export class ActiveProblemCoordinator implements IActiveProblemCoordinator {
  private active: ActiveData | null = null;
  private lastAccessMap: Map<UUID, number> = new Map();

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
    setInterval(async () => {
      const now = Date.now();
      for (const [id, lastAccess] of this.lastAccessMap)
        if (
          now - lastAccess > 60 * 1000 &&
          id !== this.active?.problemId &&
          (await this.repo.persist(id))
        ) {
          this.logger.trace('Persisted inactive problem', { id });
          this.lastAccessMap.delete(id);
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
  public async onActiveEditorChanged(filePath: string | undefined) {
    if (!filePath) return;
    const problemId = await this.repo.loadByPath(filePath);
    this.logger.trace('Active editor changed', { filePath, problemId });
    if (!problemId) {
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
    if (problemId !== this.active?.problemId) {
      // TO-DO: Check these events
      const onPatchMeta = async ({ checker, interactor }: ProblemMetaPayload) => {
        if (!this.active) return;
        this.eventBus.patchMeta(this.active.problemId, {
          checker: checker ? this.mapper.fileWithHashToDto(checker) : checker,
          interactor: interactor ? this.mapper.fileWithHashToDto(interactor) : interactor,
        });
        // this.problemFs.signals.emit('patchProblem', this.active.problem.src.path);
      };
      const onPatchStressTest = async (payload: Partial<StressTest>) => {
        if (!this.active) return;
        this.eventBus.patchStressTest(this.active.problemId, this.mapper.stressTestToDto(payload));
        // this.problemFs.signals.emit('patchProblem', this.active.problem.src.path);
      };
      const onAddTestcase = async (id: UUID, payload: Testcase) => {
        if (!this.active) return;
        this.eventBus.addTestcase(this.active.problemId, id, this.mapper.testcaseToDto(payload));
        // this.problemFs.signals.emit('addTestcase', this.active.problem.src.path, id, payload);
      };
      const onDeleteTestcase = async (id: UUID) => {
        if (!this.active) return;
        this.eventBus.deleteTestcase(this.active.problemId, id);
        // this.problemFs.signals.emit('deleteTestcase', this.active.problem.src.path, id);
      };
      const onPatchTestcase = async (id: UUID, payload: Partial<Testcase>) => {
        if (!this.active) return;
        this.eventBus.patchTestcase(this.active.problemId, id, this.mapper.testcaseToDto(payload));
        // this.problemFs.signals.emit('patchTestcase', this.active.problem.src.path, id, payload);
      };
      const onPatchTestcaseResult = async (id: UUID, payload: Partial<TestcaseResult>) => {
        if (!this.active) return;
        this.eventBus.patchTestcaseResult(
          this.active.problemId,
          id,
          this.mapper.testcaseResultToDto(payload),
        );
        // this.problemFs.signals.emit('patchTestcase', this.active.problem.src.path, id, payload);
      };

      if (this.active) {
        const problem = this.active.problem;
        problem.signals.off('patchMeta', onPatchMeta);
        problem.signals.off('patchStressTest', onPatchStressTest);
        problem.signals.off('addTestcase', onAddTestcase);
        problem.signals.off('deleteTestcase', onDeleteTestcase);
        problem.signals.off('patchTestcase', onPatchTestcase);
        problem.signals.off('patchTestcaseResult', onPatchTestcaseResult);
        await this.repo.persist(this.active.problemId);
      }
      const bgProblem = await this.repo.get(problemId);
      const problem = bgProblem?.problem;
      if (!problem) {
        this.logger.error('Active problem not found in repository after loading', { problemId });
        return;
      }
      this.active = { problemId, problem };
      this.lastAccessMap.set(problemId, Date.now());
      this.eventBus.fullProblem(problemId, this.mapper.toDto(problem));
      problem.signals.on('patchMeta', onPatchMeta);
      problem.signals.on('patchStressTest', onPatchStressTest);
      problem.signals.on('addTestcase', onAddTestcase);
      problem.signals.on('deleteTestcase', onDeleteTestcase);
      problem.signals.on('patchTestcase', onPatchTestcase);
      problem.signals.on('patchTestcaseResult', onPatchTestcaseResult);
    }
  }
}

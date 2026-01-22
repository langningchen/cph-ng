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
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type { BfCompare } from '@/domain/entities/bfCompare';
import type { ProblemMetaPayload } from '@/domain/entities/problem';
import type { Tc, TcResult } from '@/domain/entities/tc';
import { WebviewProblemMapper } from '@/infrastructure/vscode/webviewProblemMapper';

@injectable()
export class ActiveProblemCoordinator {
  private activeProblemId: UUID | null = null;
  private lastAccessMap: Map<UUID, number> = new Map();

  public constructor(
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
    @inject(TOKENS.extensionContext) private readonly context: IExtensionContext,
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
        )
          this.lastAccessMap.delete(id);
    }, 1000);
  }

  public async dispatchFullData() {
    if (this.activeProblemId) {
      const bgProblem = await this.repo.get(this.activeProblemId);
      if (bgProblem)
        this.eventBus.fullProblem(this.activeProblemId, this.mapper.toDto(bgProblem.problem));
    }
  }
  public async onActiveEditorChanged(filePath: string | undefined) {
    if (!filePath) return;
    const problemId =
      (await this.repo.getIdByPath(filePath)) || (await this.repo.loadByPath(filePath));
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
          checker: checker ? this.mapper.fileWithHashToDto(checker) : undefined,
          interactor: interactor ? this.mapper.fileWithHashToDto(interactor) : undefined,
        });
      };
      const onPatchBfCompare = async (payload: Partial<BfCompare>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchBfCompare(this.activeProblemId, this.mapper.bfCompareToDto(payload));
      };
      const onAddTc = async (id: UUID, payload: Tc) => {
        if (!this.activeProblemId) return;
        this.eventBus.addTc(this.activeProblemId, id, this.mapper.tcToDto(payload));
      };
      const onDeleteTc = async (id: UUID) => {
        if (!this.activeProblemId) return;
        this.eventBus.deleteTc(this.activeProblemId, id);
      };
      const onPatchTc = async (id: UUID, payload: Partial<Tc>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchTc(this.activeProblemId, id, this.mapper.tcToDto(payload));
      };
      const onPatchTcResult = async (id: UUID, payload: Partial<TcResult>) => {
        if (!this.activeProblemId) return;
        this.eventBus.patchTcResult(this.activeProblemId, id, this.mapper.tcResultToDto(payload));
      };

      if (this.activeProblemId) {
        const bgProblem = await this.repo.get(this.activeProblemId);
        const problem = bgProblem?.problem;
        if (problem) {
          problem.signals.off('patchMeta', onPatchMeta);
          problem.signals.off('patchBfCompare', onPatchBfCompare);
          problem.signals.off('addTc', onAddTc);
          problem.signals.off('deleteTc', onDeleteTc);
          problem.signals.off('patchTc', onPatchTc);
          problem.signals.off('patchTcResult', onPatchTcResult);
          await this.repo.persist(this.activeProblemId);
        }
      }
      this.activeProblemId = problemId;
      this.lastAccessMap.set(problemId, Date.now());
      const bgProblem = await this.repo.get(problemId);
      if (!bgProblem) return;
      this.eventBus.fullProblem(problemId, this.mapper.toDto(bgProblem.problem));
      bgProblem.problem.signals.on('patchMeta', onPatchMeta);
      bgProblem.problem.signals.on('patchBfCompare', onPatchBfCompare);
      bgProblem.problem.signals.on('addTc', onAddTc);
      bgProblem.problem.signals.on('deleteTc', onDeleteTc);
      bgProblem.problem.signals.on('patchTc', onPatchTc);
      bgProblem.problem.signals.on('patchTcResult', onPatchTcResult);
    }
  }
}

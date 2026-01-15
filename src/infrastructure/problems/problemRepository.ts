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
import type { IClock } from '@/application/ports/node/IClock';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import type { IWebviewBackgroundProblem } from '@/domain/webviewTypes';

@injectable()
export class ProblemRepository implements IProblemRepository {
  private backgroundProblems: Map<UUID, BackgroundProblem> = new Map();

  public constructor(
    @inject(TOKENS.clock) private readonly clock: IClock,
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
  ) {
    this.logger = this.logger.withScope('ProblemRepository');
  }

  public getDataPath(srcPath: string): string | null {
    return this.resolver.renderPathWithFile(this.settings.problem.problemFilePath, srcPath, true);
  }

  private fireBackgroundEvent() {
    const backgroundProblems: IWebviewBackgroundProblem[] = [];
    for (const bgProblem of this.backgroundProblems.values())
      backgroundProblems.push({
        name: bgProblem.problem.name,
        srcPath: bgProblem.problem.src.path,
      });
    this.eventBus.background(backgroundProblems);
  }

  public async loadByPath(srcPath: string, allowCreate = true): Promise<UUID | null> {
    let problem = await this.problemService.loadBySrc(srcPath);
    if (!problem) {
      if (!allowCreate) {
        this.logger.debug('No problem found for path', srcPath);
        return null;
      }
      this.logger.debug('No problem found for path', srcPath, ', creating new one');
      problem = await this.problemService.create(srcPath);
      if (!problem) {
        this.logger.error('Failed to create problem for path', srcPath);
        return null;
      }
    }
    this.logger.debug('Loaded problem', problem.src.path, 'for path', srcPath);
    const problemId = this.crypto.randomUUID();
    this.backgroundProblems.set(
      problemId,
      new BackgroundProblem(problemId, problem, this.clock.now()),
    );
    this.fireBackgroundEvent();
    return problemId;
  }

  public async get(problemId?: UUID): Promise<BackgroundProblem | undefined> {
    if (!problemId) return undefined;
    return this.backgroundProblems.get(problemId);
  }

  public async getIdByPath(srcPath: string): Promise<UUID | undefined> {
    for (const [problemId, fullProblem] of this.backgroundProblems.entries())
      if (fullProblem.problem.isRelated(srcPath)) return problemId;
    return undefined;
  }

  public async persist(problemId: UUID): Promise<boolean> {
    const fullProblem = this.backgroundProblems.get(problemId);
    if (!fullProblem || fullProblem.ac) return false;
    fullProblem.addTimeElapsed(this.clock.now());
    await this.problemService.save(fullProblem.problem);
    this.backgroundProblems.delete(problemId);
    this.fireBackgroundEvent();
    this.logger.debug('Persisted problem', problemId);
    return true;
  }

  // async dataRefresh(noMsg = false): Promise<void> {
  //   this.logger.trace('Starting data refresh');
  //   const activePath = getActivePath();
  // if (activePath) {
  //   const idles: FullProblem[] = this.fullProblems.filter(
  //     (fullProblem) =>
  //       !fullProblem.ac && // No running task
  //       !fullProblem.problem.isRelated(activePath), // Not the active problem
  //   );
  //   for (const idle of idles)
  //     this.fullProblems.delete(idle.problem);
  // }

  //   const fullProblem = await this.getProblem(activePath);
  //   const canImport = !!activePath && (await this.cphMigration.canMigrate(activePath));
  //   if (!noMsg)
  //     sidebarProvider.event.emit('problem', {
  //       problem: fullProblem && {
  //         problem: fullProblem.problem,
  //         startTime: fullProblem.startTime,
  //       },
  //       bgProblems: this.fullProblems
  //         .map((bgProblem) => ({
  //           name: bgProblem.problem.name,
  //           srcPath: bgProblem.problem.src.path,
  //         }))
  //         .filter((bgProblem) => bgProblem.srcPath !== fullProblem?.problem.src.path),
  //       canImport,
  //     });
  //   ExtensionManager.event.emit('context', {
  //     hasProblem: !!fullProblem,
  //     canImport,
  //     isRunning: !!fullProblem?.ac,
  //   });
  //   if (fullProblem) await this.problemFs.fireAuthorityChange(fullProblem.problem.src.path);
  // }
}

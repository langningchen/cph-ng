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
import type { ILogger } from '@/application/ports/vscode/ILogger';
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
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.webviewEventBus) private readonly eventBus: IWebviewEventBus,
  ) {
    this.logger = this.logger.withScope('problemRepository');
  }

  public fireBackgroundEvent() {
    const backgroundProblems: IWebviewBackgroundProblem[] = [];
    for (const bgProblem of this.backgroundProblems.values())
      backgroundProblems.push({
        name: bgProblem.problem.name,
        srcPath: bgProblem.problem.src.path,
      });
    this.eventBus.background(backgroundProblems);
  }

  public async loadByPath(srcPath: string, allowCreate: boolean = false): Promise<UUID | null> {
    for (const [problemId, fullProblem] of this.backgroundProblems.entries())
      if (fullProblem.problem.isRelated(srcPath)) return problemId;
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
}

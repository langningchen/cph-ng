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

import { existsSync } from 'node:fs';
import { inject, injectable } from 'tsyringe';
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import ExtensionManager from '@/modules/extensionManager';
import { CphProblem } from '@/modules/problems/cphProblem';
import { getActivePath, sidebarProvider, waitUntil } from '@/utils/global';

@injectable()
export class ProblemRepository implements IProblemRepository {
  private fullProblems: FullProblem[] = [];

  constructor(
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.pathResolver) private readonly resolver: IPathResolver,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.problemFs) private readonly problemFs: IProblemFs,
  ) {
    this.logger = this.logger.withScope('ProblemRepository');
  }

  public getDataPath(srcPath: string): string | null {
    return this.resolver.renderPathWithFile(this.settings.problem.problemFilePath, srcPath, true);
  }

  async listFullProblems(): Promise<FullProblem[]> {
    return this.fullProblems;
  }

  async getFullProblem(path?: string): Promise<FullProblem | null> {
    if (!path) {
      return null;
    }
    for (const fullProblem of this.fullProblems) {
      if (fullProblem.problem.isRelated(path)) {
        this.logger.trace('Found loaded problem', fullProblem.problem.src.path, 'for path', path);
        return fullProblem;
      }
    }
    const problem = await this.problemService.loadBySrc(path);
    if (!problem) {
      this.logger.debug('Failed to load problem for path', path);
      return null;
    }
    this.logger.debug('Loaded problem', problem.src.path, 'for path', path);
    const fullProblem: FullProblem = {
      problem,
      ac: null,
      startTime: Date.now(),
    };
    this.fullProblems.push(fullProblem);
    return fullProblem;
  }

  removeProblem(fullProblem: FullProblem): void {
    this.fullProblems = this.fullProblems.filter((p) => p !== fullProblem);
  }

  async dataRefresh(noMsg = false): Promise<void> {
    this.logger.trace('Starting data refresh');
    const activePath = getActivePath();
    if (activePath) {
      const idles: FullProblem[] = this.fullProblems.filter(
        (fullProblem) =>
          !fullProblem.ac && // No running task
          !fullProblem.problem.isRelated(activePath), // Not the active problem
      );
      for (const idle of idles) {
        idle.problem.addTimeElapsed(Date.now() - idle.startTime);
        await this.problemService.save(idle.problem);
        this.logger.debug('Closed idle problem', idle.problem.src.path);
      }
      this.fullProblems = this.fullProblems.filter((p) => !idles.includes(p));
    }

    const fullProblem = await this.getFullProblem(activePath);
    const canImport = !!activePath && existsSync(CphProblem.getProbBySrc(activePath));
    noMsg ||
      sidebarProvider.event.emit('problem', {
        problem: fullProblem && {
          problem: fullProblem.problem,
          startTime: fullProblem.startTime,
        },
        bgProblems: this.fullProblems
          .map((bgProblem) => ({
            name: bgProblem.problem.name,
            srcPath: bgProblem.problem.src.path,
          }))
          .filter((bgProblem) => bgProblem.srcPath !== fullProblem?.problem.src.path),
        canImport,
      });
    ExtensionManager.event.emit('context', {
      hasProblem: !!fullProblem,
      canImport,
      isRunning: !!fullProblem?.ac,
    });
    fullProblem && (await this.problemFs.fireAuthorityChange(fullProblem.problem.src.path));
  }

  async closeAll(): Promise<void> {
    for (const fullProblem of this.fullProblems) {
      fullProblem.ac?.abort();
      await waitUntil(() => !fullProblem.ac);
      fullProblem.problem.addTimeElapsed(Date.now() - fullProblem.startTime);
      await this.problemService.save(fullProblem.problem);
    }
    this.fullProblems = [];
  }
}

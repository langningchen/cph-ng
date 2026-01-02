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
import { injectable } from 'tsyringe';
import type {
  FullProblem,
  IProblemRepository,
} from '@/application/ports/problems/IProblemRepository';
import Logger from '@/helpers/logger';
import ExtensionManager from '@/modules/extensionManager';
import { CphProblem } from '@/modules/problems/cphProblem';
import { Problem } from '@/types';
import { getActivePath, problemFs, sidebarProvider, waitUntil } from '@/utils/global';

@injectable()
export class ProblemRepository implements IProblemRepository {
  private logger = new Logger('ProblemRepository');
  private fullProblems: FullProblem[] = [];

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
    const problem = await Problem.fromSrc(path);
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
    const idles: FullProblem[] = this.fullProblems.filter(
      (fullProblem) => !fullProblem.ac && !fullProblem.problem.isRelated(activePath),
    );
    for (const idle of idles) {
      idle.problem.timeElapsed += Date.now() - idle.startTime;
      await idle.problem.save();
      this.logger.debug('Closed idle problem', idle.problem.src.path);
    }
    this.fullProblems = this.fullProblems.filter((p) => !idles.includes(p));

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
    fullProblem && (await problemFs.fireAuthorityChange(fullProblem.problem.src.path));
  }

  async closeAll(): Promise<void> {
    for (const fullProblem of this.fullProblems) {
      fullProblem.ac?.abort();
      await waitUntil(() => !fullProblem.ac);
      fullProblem.problem.timeElapsed += Date.now() - fullProblem.startTime;
      await fullProblem.problem.save();
    }
    this.fullProblems = [];
  }
}

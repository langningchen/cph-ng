import { existsSync } from 'fs';
import Logger from '@/helpers/logger';
import ExtensionManager from '@/modules/extensionManager';
import { Problem } from '@/types';
import {
  getActivePath,
  problemFs,
  sidebarProvider,
  waitUntil,
} from '@/utils/global';
import { CphProblem } from '../cphProblem';

export interface FullProblem {
  problem: Problem;
  ac: AbortController | null;
  startTime: number;
}

class Store {
  private static logger: Logger = new Logger('problemsManagerStore');
  private static fullProblems: FullProblem[] = [];

  public static async listFullProblems(): Promise<FullProblem[]> {
    return this.fullProblems;
  }

  public static async getFullProblem(
    path?: string,
  ): Promise<FullProblem | null> {
    if (!path) {
      return null;
    }
    for (const fullProblem of this.fullProblems) {
      if (fullProblem.problem.isRelated(path)) {
        this.logger.trace(
          'Found loaded problem',
          fullProblem.problem.src.path,
          'for path',
          path,
        );
        return fullProblem;
      }
    }
    const problem = await Problem.fromSrc(path);
    if (!problem) {
      this.logger.debug('Failed to load problem for path', path);
      return null;
    }
    this.logger.debug('Loaded problem', problem.src.path, 'for path', path);
    const fullProblem = {
      problem,
      ac: null,
      startTime: Date.now(),
    } satisfies FullProblem;
    this.fullProblems.push(fullProblem);
    return fullProblem;
  }

  public static async dataRefresh(noMsg = false, fireFs = true) {
    this.logger.trace('Starting data refresh');
    const activePath = getActivePath();
    const idles: FullProblem[] = this.fullProblems.filter(
      (fullProblem) =>
        !fullProblem.ac && !fullProblem.problem.isRelated(activePath),
    );
    for (const idle of idles) {
      idle.problem.timeElapsed += Date.now() - idle.startTime;
      await idle.problem.save();
      this.logger.debug('Closed idle problem', idle.problem.src.path);
    }
    this.fullProblems = this.fullProblems.filter((p) => !idles.includes(p));

    const fullProblem = await this.getFullProblem(activePath);
    const canImport =
      !!activePath && existsSync(CphProblem.getProbBySrc(activePath));
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
          .filter(
            (bgProblem) => bgProblem.srcPath !== fullProblem?.problem.src.path,
          ),
        canImport,
      });
    ExtensionManager.event.emit('context', {
      hasProblem: !!fullProblem,
      canImport,
      isRunning: !!fullProblem?.ac,
    });
    if (fullProblem && fireFs) {
      await problemFs.fireAuthorityChange(fullProblem.problem.src.path);
    }
  }

  public static async closeAll() {
    for (const fullProblem of this.fullProblems) {
      fullProblem.ac?.abort();
      await waitUntil(() => !fullProblem.ac);
      fullProblem.problem.timeElapsed += Date.now() - fullProblem.startTime;
      await fullProblem.problem.save();
    }
    this.fullProblems = [];
  }

  // Helper to remove a problem from the list (used by delProblem)
  public static removeProblem(fullProblem: FullProblem) {
    this.fullProblems = this.fullProblems.filter((p) => p !== fullProblem);
  }
}

export default Store;

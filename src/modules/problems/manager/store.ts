import { container } from 'tsyringe';
import Logger from '@/helpers/logger';
import { TOKENS } from '@/composition/tokens';
import type { IProblemRepository, FullProblem } from '@/application/ports/problems/IProblemRepository';

/**
 * @deprecated Use ProblemRepository instead. This class is a backward-compatibility adapter.
 * The Store class now delegates all operations to ProblemRepository via DI container.
 */
class Store {
  private static logger: Logger = new Logger('problemsManagerStore');

  private static getRepository(): IProblemRepository {
    return container.resolve(TOKENS.ProblemRepository);
  }

  /**
   * @deprecated Use ProblemRepository.listFullProblems() instead
   */
  public static async listFullProblems(): Promise<FullProblem[]> {
    return this.getRepository().listFullProblems();
  }

  /**
   * @deprecated Use ProblemRepository.getFullProblem() instead
   */
  public static async getFullProblem(
    path?: string,
  ): Promise<FullProblem | null> {
    return this.getRepository().getFullProblem(path);
  }

  /**
   * @deprecated Use ProblemRepository.dataRefresh() instead
   */
  public static async dataRefresh(noMsg = false) {
    return this.getRepository().dataRefresh(noMsg);
  }

  /**
   * @deprecated Use ProblemRepository.closeAll() instead
   */
  public static async closeAll() {
    return this.getRepository().closeAll();
  }

  /**
   * @deprecated Use ProblemRepository.removeProblem() instead
   */
  public static removeProblem(fullProblem: FullProblem) {
    return this.getRepository().removeProblem(fullProblem);
  }
}

export default Store;
export type { FullProblem };

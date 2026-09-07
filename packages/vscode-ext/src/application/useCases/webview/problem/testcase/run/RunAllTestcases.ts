import type { RunAllTestcasesMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import { BaseProblemUseCase } from '@/application/useCases/webview/problem/BaseProblemUseCase';
import { TOKENS } from '@/composition/tokens';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';
import { RpcJudgeService } from '@/infrastructure/rpc/judgeService';

@injectable()
export class RunAllTestcases extends BaseProblemUseCase<RunAllTestcasesMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) repo: IProblemRepository,
    @inject(RpcJudgeService) private readonly judge: RpcJudgeService,
  ) {
    super(repo);
  }
  protected async performAction(bg: BackgroundProblem, msg: RunAllTestcasesMsg): Promise<void> {
    await this.judge.run(bg, undefined, false, msg.forceCompile);
  }
}

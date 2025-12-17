import type * as msgs from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { ICompiler } from '@/application/ports/ICompiler';
import type { IProblemRepository } from '@/application/ports/IProblemRepository';
import type { IRunner } from '@/application/ports/IRunner';
import { TOKENS } from '@/composition/tokens';
import ProblemsManager from '@/modules/problems/manager';
import { err, ok, type Result } from '@/shared/result';
import type { Problem, TcWithResult } from '@/types';
import { isExpandVerdict } from '@/types';
import { TcResult, TcVerdicts } from '@/types/types.backend';

@injectable()
export class RunSingleTc {
  constructor(
    @inject(TOKENS.ProblemRepository)
    private readonly repo: IProblemRepository,
    @inject(TOKENS.Compiler)
    private readonly compiler: ICompiler,
    @inject(TOKENS.Runner)
    private readonly runner: IRunner,
  ) {}

  async exec(msg: msgs.RunTcMsg): Promise<Result<void, Error>> {
    if (!msg.activePath) {
      return err(new Error('Active path is required'));
    }

    const problem = (await this.repo.getById(msg.activePath)) as Problem | null;
    if (!problem) {
      return err(new Error('Problem not found'));
    }
    const tc = problem.tcs[msg.id] as TcWithResult | undefined;
    if (!tc) {
      return err(new Error('Test case not found'));
    }

    // Prepare result state
    tc.result?.dispose();
    tc.result = new TcResult(TcVerdicts.CP);
    tc.isExpand = false;
    await this.repo.save(problem);
    await ProblemsManager.dataRefresh();

    const ac = new AbortController();

    const compileOutcome = await this.compiler.compile(
      problem,
      msg.compile,
      ac,
    );
    if (!compileOutcome.ok) {
      if ('known' in compileOutcome) {
        tc.result.fromResult(compileOutcome.known);
        tc.isExpand = true;
        await this.repo.save(problem);
        await ProblemsManager.dataRefresh();
        return ok(undefined);
      }
      return err(compileOutcome.error);
    }

    tc.result.verdict = TcVerdicts.CPD;
    await this.repo.save(problem);
    await ProblemsManager.dataRefresh();

    const runOutcome = await this.runner.run(
      problem,
      tc,
      compileOutcome.data.srcLang,
      ac,
      compileOutcome.data,
    );
    if (!runOutcome.ok) {
      if ('known' in runOutcome) {
        tc.result.fromResult(runOutcome.known as any);
      } else {
        tc.result.verdict = TcVerdicts.SE;
        tc.result.msg.push(runOutcome.error.message);
      }
    }

    tc.isExpand = isExpandVerdict(tc.result.verdict);
    await this.repo.save(problem);
    await ProblemsManager.dataRefresh();
    return ok(undefined);
  }
}

export default RunSingleTc;

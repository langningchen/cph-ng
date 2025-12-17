import type { CompileOutcome, ICompiler } from '@/application/ports/ICompiler';
import { Compiler } from '@/core/compiler';
import type { Problem } from '@/types';
import { KnownResult } from '@/utils/result';

export class CompilerAdapter implements ICompiler {
  async compile(
    problem: Problem,
    compileFlag: boolean | null,
    ac: AbortController,
  ): Promise<CompileOutcome> {
    try {
      const result = await Compiler.compileAll(problem, compileFlag, ac);
      if (result instanceof KnownResult) {
        return { ok: false, known: result };
      }
      return { ok: true, data: result.data };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}

export default CompilerAdapter;

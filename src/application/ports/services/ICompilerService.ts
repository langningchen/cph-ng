import type { Lang, LangCompileData } from '@/core/langs/lang';
import type { Problem } from '@/types';
import type { Result } from '@/utils/result';

export interface CompileData {
  src: LangCompileData;
  srcLang: Lang;
  checker?: LangCompileData;
  interactor?: LangCompileData;
  bfCompare?: {
    generator: LangCompileData;
    bruteForce: LangCompileData;
  };
}

export type CompileResult = Result<CompileData>;

export interface ICompilerService {
  compileAll(
    problem: Problem,
    compile: boolean | null,
    ac: AbortController,
  ): Promise<CompileResult>;
}

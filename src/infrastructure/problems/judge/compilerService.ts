import { inject, injectable } from 'tsyringe';
import type {
  CompileData,
  CompileResult,
  ICompilerService,
} from '@/application/ports/problems/judge/ICompilerService';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { LangCompileResult } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import type { FileWithHash, IProblem } from '@/types';

@injectable()
export class CompilerService implements ICompilerService {
  constructor(
    @inject(TOKENS.LanguageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.Translator) private readonly translator: ITranslator,
  ) {
    this.logger = logger.withScope('CompilerService');
  }

  private async optionalCompile(
    file: FileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
  ): Promise<LangCompileResult> {
    const checkerLang = this.lang.getLang(file.path);
    if (checkerLang) return await checkerLang.compile(file, signal, forceCompile);
    return { path: file.path };
  }

  public async compileAll(
    problem: IProblem,
    forceCompile: boolean | null,
    signal: AbortSignal,
  ): Promise<CompileResult> {
    // Compile source code
    const srcLang = this.lang.getLang(problem.src.path);
    if (!srcLang) {
      return new Error(
        this.translator.t('Cannot determine the programming language of the source file: {file}.', {
          file: problem.src.path,
        }),
      );
    }
    const result = await srcLang.compile(problem.src, signal, forceCompile, {
      canUseWrapper: true,
      overrides: problem.overrides,
    });
    if (result instanceof Error) return result;
    problem.src.hash = result.hash;
    const data: CompileData = {
      solution: result,
    };

    // Compile checker
    if (problem.checker) {
      const checkerResult = await this.optionalCompile(problem.checker, signal, forceCompile);
      if (checkerResult instanceof Error) return checkerResult;
      problem.checker.hash = checkerResult.hash;
      data.checker = checkerResult;
    }

    // Compile interactor
    if (problem.interactor) {
      const interactorResult = await this.optionalCompile(problem.interactor, signal, forceCompile);
      if (interactorResult instanceof Error) return interactorResult;
      problem.interactor.hash = interactorResult.hash;
      data.interactor = interactorResult;
    }

    // Compile brute force comparison programs
    if (problem.bfCompare?.generator && problem.bfCompare?.bruteForce) {
      const generatorResult = await this.optionalCompile(
        problem.bfCompare.generator,
        signal,
        forceCompile,
      );
      if (generatorResult instanceof Error) return generatorResult;
      problem.bfCompare.generator.hash = generatorResult.hash;

      const bruteForceResult = await this.optionalCompile(
        problem.bfCompare.bruteForce,
        signal,
        forceCompile,
      );
      if (bruteForceResult instanceof Error) return bruteForceResult;
      problem.bfCompare.bruteForce.hash = bruteForceResult.hash;
      data.bfCompare = {
        generator: generatorResult,
        bruteForce: bruteForceResult,
      };
    }
    this.logger.trace('Compilation succeeded', data);
    return data;
  }
}

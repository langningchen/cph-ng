import { inject, injectable } from 'tsyringe';
import type {
  CompileData,
  CompileResult,
  ICompilerService,
} from '@/application/ports/problems/ICompilerService';
import type { ILanguageRegistry } from '@/application/ports/problems/langs/ILanguageRegistry';
import type { LangCompileResult } from '@/application/ports/problems/langs/ILanguageStrategy';
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
    ac: AbortController,
    forceCompile: boolean | null,
  ): Promise<LangCompileResult> {
    const checkerLang = this.lang.getLang(file.path);
    if (checkerLang) return await checkerLang.compile(file, ac, forceCompile);
    return { path: file.path };
  }

  public async compileAll(
    problem: IProblem,
    compile: boolean | null,
    ac: AbortController,
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
    const result = await srcLang.compile(problem.src, ac, compile, {
      canUseWrapper: true,
      overwrites: problem.overwrites,
    });
    if (result instanceof Error) return result;
    problem.src.hash = result.hash;
    const data: CompileData = {
      solution: result,
    };

    // Compile checker
    if (problem.checker) {
      const checkerResult = await this.optionalCompile(problem.checker, ac, compile);
      if (checkerResult instanceof Error) return checkerResult;
      problem.checker.hash = checkerResult.hash;
      data.checker = checkerResult;
    }

    // Compile interactor
    if (problem.interactor) {
      const interactorResult = await this.optionalCompile(problem.interactor, ac, compile);
      if (interactorResult instanceof Error) return interactorResult;
      problem.interactor.hash = interactorResult.hash;
      data.interactor = interactorResult;
    }

    // Compile brute force comparison programs
    if (problem.bfCompare?.generator && problem.bfCompare?.bruteForce) {
      const generatorResult = await this.optionalCompile(problem.bfCompare.generator, ac, compile);
      if (generatorResult instanceof Error) return generatorResult;
      problem.bfCompare.generator.hash = generatorResult.hash;

      const bruteForceResult = await this.optionalCompile(
        problem.bfCompare.bruteForce,
        ac,
        compile,
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

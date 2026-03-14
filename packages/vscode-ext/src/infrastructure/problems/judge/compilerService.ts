import type { IFileWithHash } from '@cph-ng/core';
import type {
  CompileData,
  CompileResult,
  ICompilerService,
} from '@v/application/ports/problems/judge/ICompilerService';
import type { ILanguageRegistry } from '@v/application/ports/problems/judge/langs/ILanguageRegistry';
import type { LangCompileResult } from '@v/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import { TOKENS } from '@v/composition/tokens';
import type { Problem } from '@v/domain/entities/problem';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CompilerService implements ICompilerService {
  public constructor(
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    this.logger = logger.withScope('CompilerService');
  }

  private async optionalCompile(
    file: IFileWithHash,
    signal: AbortSignal,
    forceCompile: boolean | null,
  ): Promise<LangCompileResult> {
    const checkerLang = this.lang.getLang(file.path);
    if (checkerLang) return await checkerLang.compile(file, signal, forceCompile);
    return { path: file.path, hash: null };
  }

  public async compileAll(
    problem: Problem,
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
    if (problem.stressTest.generator && problem.stressTest.bruteForce) {
      const generatorResult = await this.optionalCompile(
        problem.stressTest.generator,
        signal,
        forceCompile,
      );
      if (generatorResult instanceof Error) return generatorResult;
      problem.stressTest.generator.hash = generatorResult.hash;

      const bruteForceResult = await this.optionalCompile(
        problem.stressTest.bruteForce,
        signal,
        forceCompile,
      );
      if (bruteForceResult instanceof Error) return bruteForceResult;
      problem.stressTest.bruteForce.hash = bruteForceResult.hash;
      data.stressTest = {
        generator: generatorResult,
        bruteForce: bruteForceResult,
      };
    }
    this.logger.trace('Compilation succeeded', data);
    return data;
  }
}

import { inject, injectable } from 'tsyringe';
import { l10n } from 'vscode';
import type {
  CompileResult,
  ICompilerService,
} from '@/application/ports/services/ICompilerService';
import type { ILanguageRegistry } from '@/application/ports/services/ILanguageRegistry';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import type { CompileData } from '@/core/compiler';
import type { LangCompileResult } from '@/core/langs/lang';
import { type FileWithHash, type Problem, TcVerdicts } from '@/types';
import { KnownResult, UnknownResult } from '@/utils/result';

@injectable()
export class CompilerService implements ICompilerService {
  private readonly logger: ILogger;

  constructor(
    @inject(TOKENS.Logger) logger: ILogger,
    @inject(TOKENS.LanguageRegistry)
    private readonly languageRegistry: ILanguageRegistry,
  ) {
    this.logger = logger.withScope('CompilerService');
  }

  private async optionalCompile(
    file: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
  ): Promise<LangCompileResult> {
    const checkerLang = this.languageRegistry.getLang(file.path);
    if (checkerLang) {
      return await checkerLang.compile(file, ac, forceCompile);
    }
    return new UnknownResult({ outputPath: file.path });
  }

  public async compileAll(
    problem: Problem,
    compile: boolean | null,
    ac: AbortController,
  ): Promise<CompileResult> {
    // Compile source code
    const srcLang = this.languageRegistry.getLang(problem.src.path);
    if (!srcLang) {
      return new KnownResult(
        TcVerdicts.SE,
        l10n.t(
          'Cannot determine the programming language of the source file: {file}.',
          { file: problem.src.path },
        ),
      );
    }
    const result = await srcLang.compile(problem.src, ac, compile, {
      canUseWrapper: true,
      compilationSettings: problem.compilationSettings,
    });
    if (result instanceof KnownResult) {
      return new KnownResult(result.verdict, result.msg);
    }
    problem.src.hash = result.data.hash;
    const data: CompileData = {
      src: result.data,
      srcLang,
    };

    // Compile checker
    if (problem.checker) {
      const checkerResult = await this.optionalCompile(
        problem.checker,
        ac,
        compile,
      );
      if (checkerResult instanceof KnownResult) {
        return new KnownResult(checkerResult.verdict, checkerResult.msg, data);
      }
      problem.checker.hash = checkerResult.data.hash;
      data.checker = checkerResult.data;
    }

    // Compile interactor
    if (problem.interactor) {
      const interactorResult = await this.optionalCompile(
        problem.interactor,
        ac,
        compile,
      );
      if (interactorResult instanceof KnownResult) {
        return new KnownResult(
          interactorResult.verdict,
          interactorResult.msg,
          data,
        );
      }
      problem.interactor.hash = interactorResult.data.hash;
      data.interactor = interactorResult.data;
    }

    // Compile brute force comparison programs
    if (problem.bfCompare?.generator && problem.bfCompare?.bruteForce) {
      const generatorResult = await this.optionalCompile(
        problem.bfCompare.generator,
        ac,
        compile,
      );
      if (generatorResult instanceof KnownResult) {
        return new KnownResult(
          generatorResult.verdict,
          generatorResult.msg,
          data,
        );
      }
      problem.bfCompare.generator.hash = generatorResult.data.hash;

      const bruteForceResult = await this.optionalCompile(
        problem.bfCompare.bruteForce,
        ac,
        compile,
      );
      if (bruteForceResult instanceof KnownResult) {
        return new KnownResult(
          bruteForceResult.verdict,
          bruteForceResult.msg,
          data,
        );
      }
      problem.bfCompare.bruteForce.hash = bruteForceResult.data.hash;
      data.bfCompare = {
        generator: generatorResult.data,
        bruteForce: bruteForceResult.data,
      };
    }
    this.logger.trace('Compilation succeeded', data);
    return new UnknownResult(data);
  }
}

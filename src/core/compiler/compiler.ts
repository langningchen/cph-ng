// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { Lang, LangCompileData, LangCompileResult } from '@/core/langs/lang';
import Langs from '@/core/langs/langs';
import Logger from '@/helpers/logger';
import { FileWithHash, Problem, TcVerdicts } from '@/types';
import { KnownResult, Result, UnknownResult } from '@/utils/result';
import { l10n } from 'vscode';

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
type CompileResult = Result<CompileData>;

export class Compiler {
  private static logger: Logger = new Logger('compiler');

  /**
   * Compile if the file given is a compilable language
   * @returns UKE if compiled or not compilable; otherwise returns the compile error
   */
  private static async optionalCompile(
    file: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
  ): Promise<LangCompileResult> {
    const checkerLang = Langs.getLang(file.path);
    if (checkerLang) {
      return await checkerLang.compile(file, ac, forceCompile);
    }
    return new UnknownResult({ outputPath: file.path });
  }

  public static async compileAll(
    problem: Problem,
    compile: boolean | null,
    ac: AbortController,
  ): Promise<CompileResult> {
    // Compile source code
    const srcLang = Langs.getLang(problem.src.path);
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

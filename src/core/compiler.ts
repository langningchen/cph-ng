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

import * as vscode from 'vscode';
import Logger from '../helpers/logger';
import Result from '../utils/result';
import { FileWithHash, Problem } from '../utils/types';
import { TCVerdicts } from '../utils/types.backend';
import { Lang, LangCompileResult } from './langs/lang';
import Langs from './langs/langs';

export type CompileResult = Result<{
    src: NonNullable<LangCompileResult['data']>;
    checker?: NonNullable<LangCompileResult['data']>;
    interactor?: NonNullable<LangCompileResult['data']>;
    bfCompare?: {
        generator: NonNullable<LangCompileResult['data']>;
        bruteForce: NonNullable<LangCompileResult['data']>;
    };
}>;

export class Compiler {
    private static logger: Logger = new Logger('compiler');

    private static async optionalCompile(
        file: FileWithHash,
        ac: AbortController,
        compile: boolean | null,
    ): Promise<LangCompileResult> {
        const checkerLang = Langs.getLang(file.path, true);
        if (checkerLang) {
            return await checkerLang.compile(file, ac, compile);
        }
        return {
            verdict: TCVerdicts.UKE,
            msg: '',
            data: {
                outputPath: file.path,
                hash: '',
            },
        };
    }

    public static async compileAll(
        problem: Problem,
        lang: Lang,
        compile: boolean | null,
        ac: AbortController,
        includeBfCompare: boolean = false,
    ): Promise<CompileResult> {
        const result = await lang.compile(problem.src, ac, compile, {
            canUseWrapper: true,
            compilationSettings: problem.compilationSettings,
        });
        if (result.verdict !== TCVerdicts.UKE) {
            return { ...result, data: undefined };
        }
        problem.src.hash = result.data!.hash;
        const data: CompileResult['data'] = {
            src: result.data!,
        };
        if (problem.checker) {
            const checkerResult = await this.optionalCompile(
                problem.checker,
                ac,
                compile,
            );
            if (checkerResult.verdict !== TCVerdicts.UKE) {
                return { ...checkerResult, data };
            }
            problem.checker.hash = checkerResult.data!.hash;
            data.checker = checkerResult.data!;
        }
        if (problem.interactor) {
            const interactorResult = await this.optionalCompile(
                problem.interactor,
                ac,
                compile,
            );
            if (interactorResult.verdict !== TCVerdicts.UKE) {
                return { ...interactorResult, data };
            }
            problem.interactor.hash = interactorResult.data!.hash;
            data.interactor = interactorResult.data!;
        }
        if (includeBfCompare) {
            if (
                !problem.bfCompare ||
                !problem.bfCompare.generator ||
                !problem.bfCompare.bruteForce
            ) {
                return {
                    verdict: TCVerdicts.SE,
                    msg: vscode.l10n.t(
                        'Brute Force comparison data not found.',
                    ),
                };
            }
            const generatorResult = await this.optionalCompile(
                problem.bfCompare.generator,
                ac,
                compile,
            );
            if (generatorResult.verdict !== TCVerdicts.UKE) {
                return { ...generatorResult, data };
            }
            problem.bfCompare.generator.hash = generatorResult.data!.hash;
            const bruteForceResult = await this.optionalCompile(
                problem.bfCompare.bruteForce,
                ac,
                compile,
            );
            if (bruteForceResult.verdict !== TCVerdicts.UKE) {
                return { ...bruteForceResult, data };
            }
            problem.bfCompare.bruteForce.hash = bruteForceResult.data!.hash;
            data.bfCompare = {
                generator: generatorResult.data!,
                bruteForce: bruteForceResult.data!,
            };
        }
        return {
            verdict: TCVerdicts.UKE,
            msg: '',
            data,
        };
    }
}

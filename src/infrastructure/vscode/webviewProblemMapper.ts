// Copyright (C) 2026 Langning Chen
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

import type { UUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import type { IPath } from '@/application/ports/node/IPath';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import { TOKENS } from '@/composition/tokens';
import { type BfCompare, BfCompareState, isRunningState } from '@/domain/entities/bfCompare';
import type { Problem } from '@/domain/entities/problem';
import type { Tc, TcResult } from '@/domain/entities/tc';
import type { TcIo } from '@/domain/entities/tcIo';
import { Verdicts } from '@/domain/entities/verdict';
import type { IFileWithHash, IOverrides } from '@/domain/types';
import type {
  IWebviewBfCompare,
  IWebviewFileWithHash,
  IWebviewOverrides,
  IWebviewProblem,
  IWebviewTc,
  IWebviewTcIo,
  IWebviewTcResult,
} from '@/domain/webviewTypes';

@injectable()
export class WebviewProblemMapper {
  public constructor(
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.settings) private readonly settings: ISettings,
    @inject(TOKENS.languageRegistry) private readonly lang: ILanguageRegistry,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {}

  public toDto(entity: Problem): IWebviewProblem {
    const tcs: Record<UUID, IWebviewTc> = {};
    for (const id of entity.tcOrder) {
      const tc = entity.tcs.get(id);
      if (tc) tcs[id] = this.tcToDto(tc);
    }
    return {
      name: entity.name,
      url: entity.url,
      tcs,
      tcOrder: [...entity.tcOrder],
      src: this.fileWithHashToDto(entity.src),
      checker: entity.checker ? this.fileWithHashToDto(entity.checker) : null,
      interactor: entity.interactor ? this.fileWithHashToDto(entity.interactor) : null,
      bfCompare: this.bfCompareToDto(entity.bfCompare),
      timeElapsedMs: entity.timeElapsedMs,
      overrides: this.overrideToDto(entity.src.path, entity.overrides),
    };
  }

  public tcToDto(tc: Tc): IWebviewTc;
  public tcToDto(tc: Partial<Tc>): Partial<IWebviewTc>;
  public tcToDto(tc: Partial<Tc>): Partial<IWebviewTc> {
    return {
      stdin: tc.stdin ? this.tcIoToDto(tc.stdin) : undefined,
      answer: tc.answer ? this.tcIoToDto(tc.answer) : undefined,
      isExpand: tc.isExpand,
      isDisabled: tc.isDisabled,
      result: tc.verdict
        ? {
            verdict: Verdicts[tc.verdict],
            timeMs: tc.timeMs,
            memoryMb: tc.memoryMb,
            stdout: tc.stdout ? this.tcIoToDto(tc.stdout) : undefined,
            stderr: tc.stderr ? this.tcIoToDto(tc.stderr) : undefined,
            msg: tc.msg,
          }
        : undefined,
    };
  }
  public tcResultToDto(tcResult: Partial<TcResult>): Partial<IWebviewTcResult> {
    return {
      verdict: tcResult.verdict ? Verdicts[tcResult.verdict] : undefined,
      timeMs: tcResult.timeMs,
      memoryMb: tcResult.memoryMb,
      stdout: tcResult.stdout ? this.tcIoToDto(tcResult.stdout) : undefined,
      stderr: tcResult.stderr ? this.tcIoToDto(tcResult.stderr) : undefined,
      msg: tcResult.msg,
    };
  }
  private tcIoToDto(tcIo: TcIo): IWebviewTcIo {
    return tcIo.match<IWebviewTcIo>(
      (path) => ({ ...this.fileWithHashToDto({ path }), type: 'file' }),
      (data) => ({ type: 'string', data }),
    );
  }
  public bfCompareToDto(bfCompare: BfCompare): IWebviewBfCompare;
  public bfCompareToDto(bfCompare: Partial<BfCompare>): Partial<IWebviewBfCompare>;
  public bfCompareToDto(bfCompare: Partial<BfCompare>): Partial<IWebviewBfCompare> {
    const msgs = {
      [BfCompareState.inactive]: this.translator.t('Brute Force Compare is Idle'),
      [BfCompareState.compiling]: this.translator.t('Compiling...'),
      [BfCompareState.compilationError]: this.translator.t('Compilation Error'),
      [BfCompareState.generating]: this.translator.t('Generating Data (#{cnt})...', {
        cnt: bfCompare.cnt,
      }),
      [BfCompareState.runningBruteForce]: this.translator.t('Running Brute Force (#{cnt})...', {
        cnt: bfCompare.cnt,
      }),
      [BfCompareState.runningSolution]: this.translator.t('Running Solution (#{cnt})...'),
      [BfCompareState.foundDifference]: this.translator.t('Difference found at case #{cnt}', {
        cnt: bfCompare.cnt,
      }),
      [BfCompareState.internalError]: this.translator.t('Internal Error'),
    };
    return {
      generator: bfCompare.generator ? this.fileWithHashToDto(bfCompare.generator) : undefined,
      bruteForce: bfCompare.bruteForce ? this.fileWithHashToDto(bfCompare.bruteForce) : undefined,
      isRunning: isRunningState(bfCompare.state),
      msg: bfCompare.state ? msgs[bfCompare.state] : undefined,
    };
  }
  public fileWithHashToDto(fileWithHash: IFileWithHash): IWebviewFileWithHash {
    return {
      path: fileWithHash.path,
      base: this.path.basename(fileWithHash.path),
    };
  }
  private overrideToDto(
    srcPath: string,
    { timeLimitMs, memoryLimitMb, compiler, compilerArgs, runner, runnerArgs }: IOverrides,
  ): IWebviewOverrides {
    const { defaultTimeLimit, defaultMemoryLimit } = this.settings.problem;
    const lang = this.lang.getLang(srcPath);
    const defaultCompiler = lang?.defaultValues.compiler;
    const defaultCompilerArgs = lang?.defaultValues.compilerArgs;
    const defaultRunner = lang?.defaultValues.runner;
    const defaultRunnerArgs = lang?.defaultValues.runnerArgs;
    return {
      timeLimitMs: { defaultValue: defaultTimeLimit, override: timeLimitMs || null },
      memoryLimitMb: { defaultValue: defaultMemoryLimit, override: memoryLimitMb || null },
      compiler: defaultCompiler
        ? { defaultValue: defaultCompiler, override: compiler || null }
        : undefined,
      compilerArgs: defaultCompilerArgs
        ? { defaultValue: defaultCompilerArgs, override: compilerArgs || null }
        : undefined,
      runner: defaultRunner ? { defaultValue: defaultRunner, override: runner || null } : undefined,
      runnerArgs: defaultRunnerArgs
        ? { defaultValue: defaultRunnerArgs, override: runnerArgs || null }
        : undefined,
    };
  }
}

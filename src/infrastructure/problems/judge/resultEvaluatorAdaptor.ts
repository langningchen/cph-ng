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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ICheckerRunner } from '@/application/ports/problems/judge/ICheckerRunner';
import type { IResultEvaluator } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import { VerdictName } from '@/domain/entities/verdict';
import type { ExecutionData } from '@/domain/execution';
import { Grader } from '@/domain/services/Grader';

export interface JudgeRequest {
  executionResult: ExecutionData;
  inputPath: string;
  answerPath: string;
  checkerPath?: string;
  interactorResult?: {
    execution: ExecutionData;
    feedback: string;
  };
  timeLimitMs: number;
  memoryLimitMb?: number;
}

export interface FinalResult {
  verdict: VerdictName;
  timeMs?: number;
  memoryMb?: number;
  msg?: string;
}

@injectable()
export class ResultEvaluatorAdaptor implements IResultEvaluator {
  constructor(
    @inject(TOKENS.CheckerRunner) private readonly checkerRunner: ICheckerRunner,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
    @inject(Grader) private readonly grader: Grader,
  ) {}

  public async judge(req: JudgeRequest, signal: AbortSignal): Promise<FinalResult> {
    const res = req.executionResult;
    const executionStats = {
      timeMs: res.timeMs,
      memoryMb: res.memoryMb,
    };

    if (res.isUserAborted) return { ...executionStats, verdict: VerdictName.RJ };
    if (res.timeMs > req.timeLimitMs) return { ...executionStats, verdict: VerdictName.TLE };
    if (res.codeOrSignal)
      return {
        ...executionStats,
        verdict: VerdictName.RE,
        msg: `Program exited with code: ${res.codeOrSignal}`,
      };

    if (req.checkerPath) {
      const spjRes = await this.checkerRunner.run(
        {
          checkerPath: req.checkerPath,
          inputPath: req.inputPath,
          outputPath: res.stdoutPath,
          answerPath: req.answerPath,
        },
        signal,
      );
      if (spjRes instanceof Error) {
        return { ...executionStats, verdict: VerdictName.SE, msg: spjRes.message };
      }

      const verdict = this.grader.mapTestlibExitCode(spjRes.exitCode);
      return { ...executionStats, verdict, msg: spjRes.msg };
    }

    if (req.interactorResult) {
      const {
        execution: { codeOrSignal, stdoutPath, stderrPath },
        feedback,
      } = req.interactorResult;
      if (typeof codeOrSignal === 'string') throw new Error('Interactor run failed');
      const verdict = this.grader.mapTestlibExitCode(codeOrSignal);
      const msg = await this.fs.readFile(feedback);
      this.tmp.dispose([stdoutPath, stderrPath]);
      return { ...executionStats, verdict, msg };
    }

    const stdout = await this.fs.readFile(res.stdoutPath);
    const answer = await this.fs.readFile(req.answerPath);
    const stderr = await this.fs.readFile(res.stderrPath);

    const verdict = this.grader.compareStrings(stdout, answer, stderr, {
      ignoreError: this.settings.comparing.ignoreError,
      oleSize: this.settings.comparing.oleSize,
      regardPEAsAC: this.settings.comparing.regardPEAsAC,
    });

    return { ...executionStats, verdict };
  }

  public async interactiveJudge() {}
}

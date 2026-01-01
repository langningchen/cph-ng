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
import type { ICheckerRunner } from '@/application/ports/problems/ICheckerRunner';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';
import type { ExecutionData } from '@/domain/execution';
import { Grader } from '@/domain/services/Grader';
import { VerdictName } from '@/domain/verdict';

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
  messages: string[];
}

@injectable()
export class ResultEvaluator {
  constructor(
    @inject(TOKENS.CheckerRunner)
    private readonly checkerRunner: ICheckerRunner,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.TempStorage) private readonly tmp: ITempStorage,
    @inject(Grader) private readonly grader: Grader,
  ) {}

  public async judge(req: JudgeRequest, ac: AbortController): Promise<FinalResult> {
    const res = req.executionResult;
    const executionStats = {
      timeMs: res.timeMs,
      memoryMb: res.memoryMb,
    };

    if (res.isUserAborted) return { ...executionStats, verdict: VerdictName.RJ, messages: [] };
    if (res.timeMs > req.timeLimitMs)
      return { ...executionStats, verdict: VerdictName.TLE, messages: [] };
    if (res.codeOrSignal)
      return {
        ...executionStats,
        verdict: VerdictName.RE,
        messages: [`Program exited with code: ${res.codeOrSignal}`],
      };

    if (req.checkerPath) {
      const spjRes = await this.checkerRunner.run(
        {
          checkerPath: req.checkerPath,
          inputPath: req.inputPath,
          outputPath: res.stdoutPath,
          answerPath: req.answerPath,
        },
        ac,
      );
      if (spjRes instanceof Error) {
        return {
          ...executionStats,
          verdict: VerdictName.SE,
          messages: [spjRes.message],
        };
      }

      const mapped = this.grader.mapTestlibExitCode(spjRes.exitCode);
      return {
        ...executionStats,
        verdict: mapped.verdict,
        messages: [spjRes.message, ...(mapped.msg ? [mapped.msg] : [])],
      };
    }

    if (req.interactorResult) {
      const {
        execution: { codeOrSignal, stdoutPath, stderrPath },
        feedback,
      } = req.interactorResult;
      if (typeof codeOrSignal === 'string') throw new Error('Interactor run failed');
      const mapped = this.grader.mapTestlibExitCode(codeOrSignal);
      const message = await this.fs.readFile(feedback);
      this.tmp.dispose([stdoutPath, stderrPath]);
      return {
        ...executionStats,
        verdict: mapped.verdict,
        messages: [message, ...(mapped.msg ? [mapped.msg] : [])],
      };
    }

    const stdout = await this.fs.readFile(res.stdoutPath);
    const answer = await this.fs.readFile(req.answerPath);
    const stderr = await this.fs.readFile(res.stderrPath);

    const verdict = this.grader.compareStrings(stdout, answer, stderr, {
      ignoreError: this.settings.comparing.ignoreError,
      oleSize: this.settings.comparing.oleSize,
      regardPEAsAC: this.settings.comparing.regardPEAsAC,
    });

    return { ...executionStats, verdict, messages: [] };
  }

  public async interactiveJudge() {}
}

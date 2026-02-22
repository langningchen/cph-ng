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

import type { VerdictName } from '@/domain/entities/verdict';
import type { ExecutionData } from '@/domain/execution';

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

export interface IResultEvaluator {
  judge(req: JudgeRequest, signal: AbortSignal): Promise<FinalResult>;
}
